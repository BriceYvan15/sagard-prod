import { Module } from '@nestjs/common'
import { InvoicesService } from './invoices.service'
import { InvoicesController } from './invoices.controller'
import { MailModule } from '../../mail/mail.module'

@Module({
  imports: [MailModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}

