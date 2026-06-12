import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { BillingRunsService } from './billing-runs.service'

@ApiTags('CRM — Lots de facturation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing-runs')
export class BillingRunsController {
  constructor(private service: BillingRunsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des lots de facturation' })
  findAll() { return this.service.findAll() }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id) }

  @Post()
  @ApiOperation({ summary: 'Créer un lot de facturation (brouillon)' })
  create(@Body() body: any) {
    return this.service.create({
      ...body,
      invoiceDate: new Date(body.invoiceDate),
    })
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Prévisualiser les contrats éligibles' })
  preview(@Param('id') id: string) { return this.service.previewContracts(id) }

  @Post(':id/generate')
  @ApiOperation({ summary: 'Générer les factures du lot' })
  generate(@Param('id') id: string) { return this.service.generateInvoices(id) }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Annuler le lot' })
  cancel(@Param('id') id: string) { return this.service.cancel(id) }
}
