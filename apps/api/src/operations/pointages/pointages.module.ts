import { Module } from '@nestjs/common'
import { PointagesService } from './pointages.service'
import { PointagesController } from './pointages.controller'
import { NotificationsModule } from '../../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  providers: [PointagesService],
  controllers: [PointagesController],
  exports: [PointagesService],
})
export class PointagesModule {}
