import * as CryptoJS from 'crypto-js';
import { JWT } from 'next-auth/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IRegistered, RegisteredZodSchema } from './entity/register.entity';
import { DatabaseError } from 'src/errors/DatabaseError';
import { ValidationError } from 'src/errors/ValidationError';
import { IUser } from 'src/user/entity/user.entity';
import dbConnect from 'src/conn';
import * as logger from '../logger';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { IWEBPUSH_SERVICE } from 'src/utils/di.tokens';
import { IWebPushService } from 'src/webpush/webpushService.interface';
import { IRegisterService } from './registerService.interface';

export default class RegisterService implements IRegisterService {
  private token: JWT;

  constructor(
    @InjectModel('Registered') private Registered: Model<IRegistered>,
    @InjectModel('User') private User: Model<IUser>,
    @Inject(IWEBPUSH_SERVICE) private webPushServiceInstance: IWebPushService,
    @Inject(REQUEST) private readonly request: Request, // Request 객체 주입
  ) {
    this.token = this.request.decodedToken;
  }

  async encodeByAES56(tel: string) {
    const key = process.env.cryptoKey;
    if (!key) return tel;

    return CryptoJS.AES.encrypt(tel, key).toString();
  }

  async decodeByAES256(encodedTel: string) {
    const key = process.env.cryptoKey;
    if (!key) return encodedTel;

    const bytes = CryptoJS.AES.decrypt(encodedTel, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  }

  async register(subRegisterForm: Omit<IRegistered, 'uid' | 'profileImage'>) {
    const { telephone } = subRegisterForm;

    // 전화번호 검증: 010으로 시작하고 11자리 숫자인지 확인
    const telephoneRegex = /^010-\d{4}-\d{4}$/;
    if (!telephoneRegex.test(telephone)) {
      throw new Error('Invalid telephone number');
    }

    const encodedTel = await this.encodeByAES56(telephone);
    if (encodedTel === telephone) throw new Error('Key not exist');
    if (encodedTel.length == 0) throw new Error('Key not exist');

    let validatedResgisterForm;
    validatedResgisterForm = RegisteredZodSchema.parse({
      uid: this.token.uid,
      profileImage: this.token.picture,
      ...subRegisterForm,
      telephone: encodedTel,
    });

    const updated = await this.Registered.findOneAndUpdate(
      { uid: this.token.uid },
      validatedResgisterForm,
      {
        upsert: true,
        new: true,
      },
    );

    if (!updated) throw new DatabaseError('register failed');

    await this.webPushServiceInstance.sendNotificationToManager(
      subRegisterForm.location,
    );
    return;
  }

  async approve(uid: string) {
    let userForm;

    const user = await this.Registered.findOne({ uid }, '-_id -__v');
    if (!user) throw new ValidationError('wrong uid');

    userForm = {
      ...user.toObject(),
      role: 'human',
      registerDate: new Date(),
      isActive: true,
      deposit: 3000,
    };

    try {
      await this.User.findOneAndUpdate({ uid }, userForm, {
        upsert: true,
        new: true,
      });

      await this.deleteRegisterUser(uid);
    } catch (err: any) {
      throw new Error(err);
    }

    logger.logger.info('가입 보증금', {
      metadata: { type: 'deposit', uid, value: 3000 },
    });
    return;
  }

  async deleteRegisterUser(uid: string, session?: any) {
    if (session) {
      await this.Registered.deleteOne({ uid }).session(session);
    } else {
      await this.Registered.deleteOne({ uid });
    }
  }

  async getRegister() {
    const users = await this.Registered.find({});

    users.forEach(async (user) => {
      user.telephone = await this.decodeByAES256(user.telephone);
    });

    return users;
  }
}
