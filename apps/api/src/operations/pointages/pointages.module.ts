import { Module } from '@nestjs/common'
import { PointagesService } from './pointages.service'
import { PointagesController } from './pointages.controller'
import { NotificationsModule } from '../../notifications/notifications.module'
import { RolesGuard } from '../../auth/guards/roles.guard'

@Module({
  imports: [NotificationsModule],
  providers: [PointagesService, RolesGuard],
  controllers: [PointagesController],
  exports: [PointagesService],
})
export class PointagesModule {}
