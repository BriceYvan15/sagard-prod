import { Module } from '@nestjs/common'
import { TrainingsController } from './trainings.controller'
import { TrainingsService } from './trainings.service'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TrainingsController],
  providers: [TrainingsService],
})
export class TrainingsModule {}
