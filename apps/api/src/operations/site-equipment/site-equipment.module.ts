import { Module } from '@nestjs/common'
import { SiteEquipmentService } from './site-equipment.service'
import { SiteEquipmentController } from './site-equipment.controller'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [SiteEquipmentController],
  providers: [SiteEquipmentService],
})
export class SiteEquipmentModule {}
