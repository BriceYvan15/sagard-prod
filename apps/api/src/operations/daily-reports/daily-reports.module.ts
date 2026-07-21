import { Module } from '@nestjs/common'
import { DailyReportsService } from './daily-reports.service'
import { DailyReportsController } from './daily-reports.controller'
import { NotificationsModule } from '../../notifications/notifications.module'

@Module({ imports: [NotificationsModule], providers: [DailyReportsService], controllers: [DailyReportsController], exports: [DailyReportsService] })
export class DailyReportsModule {}
