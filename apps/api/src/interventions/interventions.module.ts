import { Module } from '@nestjs/common'
import { InterventionsController } from './interventions.controller'
import { InterventionsService } from './interventions.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [InterventionsController],
  providers: [InterventionsService],
})
export class InterventionsModule {}
