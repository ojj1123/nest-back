import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import helmet from 'helmet';
import compression from 'compression';
import { TokenValidatorMiddleware } from './middlewares/tokenValidator';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database.module';
import { WebPushModule } from './webpush/webpush.module';
import { VoteModule } from './vote/vote.module';
import { UserModule } from './user/user.module';
import { StaticModule } from './statics/static.module';
import { SquareModule } from './square/square.module';
import { RequestModule } from './request/request.module';
import { RegisterModule } from './register/register.module';
import { PromotionModule } from './promotion/promotion.module';
import { PlaceModule } from './place/place.module';
import { NoticeModule } from './notice/notice.module';
import { LogModule } from './logz/log.module';
import { ImageModule } from './imagez/image.module';
import { GroupStudyModule } from './groupStudy/groupStudy.module';
import { GiftModule } from './gift/gift.module';
import { GatherModule } from './gather/gather.module';
import { FcmAModule } from './fcm/fcm.module';
import { ChatModule } from './chatz/chat.module';
import { BookModule } from './book/book.module';
import { FeedModule } from './feed/feed.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { RequestContextInterceptor } from './request-context.intercepter';
import { CollectionModule } from './collection/collection.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DatabaseModule,
    WebPushModule,
    VoteModule,
    UserModule,
    StaticModule,
    SquareModule,
    RequestModule,
    RegisterModule,
    PromotionModule,
    PlaceModule,
    NoticeModule,
    LogModule,
    ImageModule,
    GroupStudyModule,
    GiftModule,
    GatherModule,
    FeedModule,
    FcmAModule,
    ChatModule,
    BookModule,
    CollectionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(helmet(), compression(), TokenValidatorMiddleware)
      .forRoutes('*');
  }
}
