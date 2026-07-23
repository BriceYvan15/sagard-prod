import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TreasuryModule } from '../treasury/treasury.module'
import { AccountingController } from './accounting.controller'
import { AccountingService } from './accounting.service'

@Module({
  imports: [PrismaModule, TreasuryModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
