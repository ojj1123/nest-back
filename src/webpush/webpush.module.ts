import { ClassProvider, Module } from '@nestjs/common';
import { WebPushController } from './webpush.controller';
import { WebPushService } from './webpush.service';
import { UserModule } from 'src/user/user.module';
import { GroupStudyModule } from 'src/groupStudy/groupStudy.module';
import { VoteModule } from 'src/vote/vote.module';
import { IWEBPUSH_REPOSITORY, IWEBPUSH_SERVICE } from 'src/utils/di.tokens';
import { MongoWebpushRepository } from './webpush.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationSubSchema } from './entity/notificationsub.entity';

const webPushServiceProvider: ClassProvider = {
  provide: IWEBPUSH_SERVICE,
  useClass: WebPushService,
};
const webPushRepositoryProvider: ClassProvider = {
  provide: IWEBPUSH_REPOSITORY,
  useClass: MongoWebpushRepository,
};

@Module({
  imports: [
    UserModule,
    GroupStudyModule,
    VoteModule,
    MongooseModule.forFeature([
      { name: 'NotificationSub', schema: NotificationSubSchema },
    ]),
  ], // Mongoose 모델 등록],
  controllers: [WebPushController],
  providers: [webPushServiceProvider, webPushRepositoryProvider],
  exports: [webPushServiceProvider, webPushRepositoryProvider],
})
export class WebPushModule {}
