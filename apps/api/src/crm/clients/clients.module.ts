import { Module } from '@nestjs/common'
import { ClientsService } from './clients.service'
import { ClientsController } from './clients.controller'
import { WhatsappModule } from '../../whatsapp/whatsapp.module'

@Module({ imports: [WhatsappModule], providers: [ClientsService], controllers: [ClientsController], exports: [ClientsService] })
export class ClientsModule {}
