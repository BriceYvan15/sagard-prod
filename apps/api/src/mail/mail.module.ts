import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { SettingsModule } from '../settings/settings.module'
import { MailService } from './mail.service'

@Module({
  imports: [PrismaModule, SettingsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
