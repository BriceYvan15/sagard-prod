import { Module } from '@nestjs/common'
import { InvoicesService } from './invoices.service'
import { InvoicesController } from './invoices.controller'
import { MailModule } from '../../mail/mail.module'
import { TreasuryModule } from '../../treasury/treasury.module'

@Module({
  imports: [MailModule, TreasuryModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}

