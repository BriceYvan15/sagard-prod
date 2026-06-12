import { Module } from '@nestjs/common'
import { AgentsService } from './agents.service'
import { AgentsController } from './agents.controller'
import { WhatsappModule } from '../../whatsapp/whatsapp.module'

@Module({ imports: [WhatsappModule], providers: [AgentsService], controllers: [AgentsController], exports: [AgentsService] })
export class AgentsModule {}
