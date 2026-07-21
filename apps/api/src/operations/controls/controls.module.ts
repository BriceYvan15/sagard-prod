import { Module } from '@nestjs/common'
import { ControlsService } from './controls.service'
import { ControlsController } from './controls.controller'
import { NotificationsModule } from '../../notifications/notifications.module'

@Module({ imports: [NotificationsModule], providers: [ControlsService], controllers: [ControlsController], exports: [ControlsService] })
export class ControlsModule {}
