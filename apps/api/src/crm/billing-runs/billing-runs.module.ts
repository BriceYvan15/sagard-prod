import { Module } from '@nestjs/common'
import { BillingRunsService } from './billing-runs.service'
import { BillingRunsController } from './billing-runs.controller'

@Module({ providers: [BillingRunsService], controllers: [BillingRunsController], exports: [BillingRunsService] })
export class BillingRunsModule {}
