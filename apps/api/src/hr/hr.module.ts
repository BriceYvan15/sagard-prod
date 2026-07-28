import { Module } from '@nestjs/common'
import { HrService } from './hr.service'
import { HrController } from './hr.controller'
import { NotificationsModule } from '../notifications/notifications.module'
import { TreasuryModule } from '../treasury/treasury.module'

@Module({ imports: [NotificationsModule, TreasuryModule], providers: [HrService], controllers: [HrController], exports: [HrService] })
export class HrModule {}
