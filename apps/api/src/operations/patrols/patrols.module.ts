import { Module } from '@nestjs/common'
import { PatrolsService } from './patrols.service'
import { PatrolsController } from './patrols.controller'

@Module({ providers: [PatrolsService], controllers: [PatrolsController], exports: [PatrolsService] })
export class PatrolsModule {}
