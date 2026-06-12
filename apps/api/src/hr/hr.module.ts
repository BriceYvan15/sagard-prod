import { Module } from '@nestjs/common'
import { HrService } from './hr.service'
import { HrController } from './hr.controller'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({ imports: [NotificationsModule], providers: [HrService], controllers: [HrController], exports: [HrService] })
export class HrModule {}
