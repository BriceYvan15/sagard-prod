import { Module } from '@nestjs/common'
import { ControlsService } from './controls.service'
import { ControlsController } from './controls.controller'

@Module({ providers: [ControlsService], controllers: [ControlsController], exports: [ControlsService] })
export class ControlsModule {}
