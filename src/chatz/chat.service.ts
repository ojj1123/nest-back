import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JWT } from 'next-auth/jwt';
import { WebPushService } from 'src/webpush/webpush.service';
import {
  Chat,
  ChatZodSchema,
  ContentZodSchema,
  IChat,
} from './entity/chat.entity';
import { IUser } from 'src/user/entity/user.entity';
import { DatabaseError } from 'src/errors/DatabaseError';
import dayjs from 'dayjs';
import { FcmService } from 'src/fcm/fcm.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { IFCM_SERVICE, IWEBPUSH_SERVICE } from 'src/utils/di.tokens';
import { IWebPushService } from 'src/webpush/webpushService.interface';
import { IFcmService } from 'src/fcm/fcm.interface';
import { IChatService } from './chatService.interface';

@Injectable()
export class ChatService implements IChatService {
  private token: JWT;

  //todo: 의존성주입
  constructor(
    @Inject(IFCM_SERVICE) private fcmServiceInstance: IFcmService,
    @Inject(IWEBPUSH_SERVICE) private webPushServiceInstance: IWebPushService,
    @InjectModel('Chat') private Chat: Model<IChat>,
    @InjectModel('User') private User: Model<IUser>,
    @Inject(REQUEST) private readonly request: Request, // Request 객체 주입
  ) {
    this.token = this.request.decodedToken;
  }

  async getChat(userId: string) {
    const user1 = this.token.id > userId ? userId : this.token.id;
    const user2 = this.token.id < userId ? userId : this.token.id;

    const chat = await this.Chat.findOne({ user1, user2 }).populate([
      'user1',
      'user2',
    ]);
    if (!chat) throw new DatabaseError("Can't find chatting");
    const opponent =
      (chat.user1 as IUser).id == this.token.id
        ? (chat.user2 as IUser)
        : (chat.user1 as IUser);
    return { opponent, contents: chat?.contents };
  }

  async getChats() {
    const chats = await this.Chat.find({
      $or: [{ user1: this.token.id }, { user2: this.token.id }],
    });

    const chatWithUsers = await Promise.all(
      chats.map(async (chat) => {
        const opponentUid =
          chat.user1 == this.token.id ? chat.user2 : chat.user1;
        const opponent = await this.User.findById(opponentUid);

        return {
          user: opponent,
          content: chat.contents.length
            ? chat.contents[chat.contents.length - 1]
            : null,
        };
      }),
    );

    return chatWithUsers.sort((a, b) => {
      if (!a.content || !b.content) {
        return 1;
      }
      const dateA = dayjs(a.content.createdAt);
      const dateB = dayjs(b.content.createdAt);
      return dateA.isAfter(dateB) ? -1 : 1;
    });
  }
  async getRecentChat() {
    const chat = await this.Chat.find({
      $or: [{ user1: this.token.id }, { user2: this.token.id }],
    })
      .sort({ createdAt: -1 })
      .limit(1);

    if (chat.length) {
      return chat?.[0]._id;
    } else {
      return '';
    }
  }

  async createChat(toUserId: string, message: string) {
    const user1 = this.token.id > toUserId ? toUserId : this.token.id;
    const user2 = this.token.id < toUserId ? toUserId : this.token.id;

    const chat = await this.Chat.findOne({ user1, user2 });

    const contentFill = {
      content: message,
      userId: this.token.id,
    };

    const validatedContent = ContentZodSchema.parse(contentFill);
    const validatedChat = ChatZodSchema.parse({
      user1,
      user2,
      contents: [contentFill],
    });

    if (chat) {
      await chat.updateOne({ $push: { contents: validatedContent } });
      await chat.save();
    } else {
      await this.Chat.create(validatedChat);
    }

    const toUser = await this.User.findById(toUserId);
    if (toUser) {
      await this.fcmServiceInstance.sendNotificationToX(
        toUser.uid,
        '쪽지를 받았어요!',
        message,
      );
      await this.webPushServiceInstance.sendNotificationToX(
        toUser.uid,
        '쪽지를 받았어요!',
        message,
      );
    } else throw new DatabaseError('toUserUid is incorrect');
  }
}
