import { JWT } from 'next-auth/jwt';
import { DatabaseError } from '../errors/DatabaseError'; // 에러 처리 클래스 (커스텀 에러)
import ImageService from 'src/imagez/image.service';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import {
  IRealtime,
  IRealtimeUser,
  RealtimeUserZodSchema,
} from './realtime.entity';
import { Model } from 'mongoose';
import { CollectionService } from 'src/collection/collection.service';
import { IVoteService } from 'src/vote/voteService.interface';
import {
  ICOLLECTION_SERVICE,
  IIMAGE_SERVICE,
  IVOTE_SERVICE,
} from 'src/utils/di.tokens';
import { IImageService } from 'src/imagez/imageService.interface';
import { ICollectionService } from 'src/collection/collectionService.interface';
import { IRealtimeService } from './realtimeService';

export default class RealtimeService implements IRealtimeService {
  private token: JWT;

  constructor(
    @InjectModel('Realtime') private RealtimeModel: Model<IRealtime>,
    @Inject(IIMAGE_SERVICE) private imageServiceInstance: IImageService,
    @Inject(IVOTE_SERVICE) private voteServiceInstance: IVoteService,
    @Inject(ICOLLECTION_SERVICE)
    private collectionServiceInstance: ICollectionService,
    @Inject(REQUEST) private readonly request: Request, // Request 객체 주입
  ) {
    this.token = this.request?.decodedToken;
  }

  getToday() {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0); // 시간을 0시 0분 0초 0밀리초로 설정
    return todayMidnight;
  }

  async getTodayData() {
    const date = this.getToday();
    const data = await this.RealtimeModel.findOne({ date });

    if (!data) {
      return await this.RealtimeModel.create({ date });
    }

    return data;
  }

  // 기본 투표 생성
  async createBasicVote(studyData: Partial<IRealtime>) {
    const date = this.getToday();
    // 데이터 유효성 검사
    const validatedUserData = RealtimeUserZodSchema.parse({
      ...studyData,
      status: 'pending',
      user: this.token.id,
    });

    this.voteServiceInstance.deleteVote(date);

    const updatedData = await this.RealtimeModel.findOneAndUpdate(
      { date },
      {
        $addToSet: { userList: validatedUserData }, // 중복 방지와 추가 동시에 수행
        $setOnInsert: { date }, // 문서가 없을 때만 date 필드 설정
      },
      {
        new: true, // 업데이트된 문서를 반환
        upsert: true, // 문서가 없으면 새로 생성
      },
    );

    return updatedData;
  }

  //todo: 수정 급함
  //test
  async markAttendance(studyData: Partial<IRealtimeUser>, buffers: Buffer[]) {
    const date = this.getToday();

    const validatedStudy = RealtimeUserZodSchema.parse({
      ...studyData,
      time: JSON.parse(studyData.time as unknown as string),
      place: JSON.parse(studyData.place as unknown as string),
      arrived: new Date(),
      user: this.token.id,
    });

    if (buffers.length) {
      const images = await this.imageServiceInstance.uploadImgCom(
        'studyAttend',
        buffers,
      );

      studyData.image = images[0];
    }

    this.voteServiceInstance.deleteVote(date);

    const updatedData = await this.RealtimeModel.findOneAndUpdate(
      { date },
      {
        $set: {
          'userList.$[elem].': validatedStudy,
        },
        $addToSet: { userList: validatedStudy }, // 중복되지 않는 사용자 추가
      },
      {
        new: true,
        upsert: true, // 없으면 새로 생성
        arrayFilters: [{ 'elem.user': this.token.id }], // 배열 필터로 특정 사용자 타겟팅
      },
    );

    const result = this.collectionServiceInstance.setCollectionStamp(
      this.token.id,
    );

    return result;
  }

  // 스터디 정보 업데이트
  async updateStudy(studyData: Partial<IRealtime>) {
    const updateFields: Record<string, any> = {};

    Object.keys(studyData).forEach((key) => {
      const value = studyData[key];
      if (value !== undefined && value !== null) {
        // `prefix`를 포함한 필드명을 동적으로 설정
        updateFields[`userList.$[elem].${key}`] = value;
      }
    });

    const updatedRealtime = await this.RealtimeModel.findOneAndUpdate(
      {
        date: this.getToday(), // date 필드가 일치하는 문서 찾기
        'userList.user': this.token.id, // userList 배열 내의 user 필드가 일치하는 문서 찾기
      },
      {
        $set: updateFields,
      },
      {
        arrayFilters: [{ 'elem.user': this.token.id }], // 배열 필터: user 필드가 일치하는 요소만 업데이트
        new: true, // 업데이트된 문서를 반환
      },
    );

    if (!updatedRealtime) throw new DatabaseError('Failed to update study');
    return updatedRealtime;
  }

  async patchVote(start: any, end: any) {
    const todayData = await this.getTodayData();
    try {
      if (start && end && todayData?.userList) {
        todayData.userList.forEach((userInfo) => {
          if (userInfo.user.toString() === this.token.id) {
            userInfo.time.start = start;
            userInfo.time.end = end;
          }
        });

        await todayData.save();
      } else {
        return new Error();
      }
    } catch (err) {
      throw new Error();
    }
  }

  async deleteVote() {
    const todayData = await this.getTodayData();
    try {
      todayData.userList = todayData.userList?.filter(
        (userInfo) => userInfo.user.toString() !== this.token.id,
      );

      await todayData.save();
    } catch (err) {
      throw new Error();
    }
  }
  async patchStatus(status: any) {
    const todayData = await this.getTodayData();

    try {
      todayData.userList?.forEach((userInfo) => {
        if (userInfo.user.toString() === this.token.id) {
          userInfo.status = status;
        }
      });

      await todayData.save();
    } catch (err) {
      throw new Error();
    }
  }
  async patchComment(comment: string) {
    const todayData = await this.getTodayData();

    try {
      todayData.userList?.forEach((userInfo) => {
        if (userInfo.user.toString() === this.token.id) {
          userInfo.comment = userInfo.comment || { text: '' };
          userInfo.comment.text = comment;
        }
      });

      await todayData.save();
    } catch (err) {
      throw new Error();
    }
  }

  // 가장 최근의 스터디 가져오기
  async getRecentStudy() {
    return this.getTodayData();
  }
}
