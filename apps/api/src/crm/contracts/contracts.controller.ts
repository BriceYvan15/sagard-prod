import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { ContractsService } from './contracts.service'

@ApiTags('CRM — Contrats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des contrats' })
  findAll(@Query('clientId') clientId?: string, @Query('status') status?: string) {
    return this.contractsService.findAll({ clientId, status })
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Contrats expirant bientôt' })
  getExpiring(@Query('days') days?: string) {
    return this.contractsService.getExpiringContracts(days ? parseInt(days) : 30)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Créer un contrat' })
  create(@Body() body: any) {
    return this.contractsService.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.contractsService.update(id, body)
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renouveler un contrat' })
  renew(@Param('id') id: string, @Body() body: { newEndDate: Date; newAmount?: number }) {
    return this.contractsService.renew(id, new Date(body.newEndDate), body.newAmount)
  }

  // ─── Transitions de statut (workflow Odoo) ───
  @Post(':id/quotation')
  @ApiOperation({ summary: 'Passer en devis' })
  toQuotation(@Param('id') id: string) { return this.contractsService.toQuotation(id) }

  @Post(':id/proforma')
  @ApiOperation({ summary: 'Passer en proforma' })
  toProforma(@Param('id') id: string) { return this.contractsService.toProforma(id) }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirmer le contrat' })
  confirm(@Param('id') id: string) { return this.contractsService.confirm(id) }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activer le contrat (nécessite des affectations actives)' })
  activate(@Param('id') id: string) { return this.contractsService.activate(id) }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspendre le contrat' })
  suspend(@Param('id') id: string) { return this.contractsService.suspend(id) }

  @Post(':id/terminate')
  @ApiOperation({ summary: 'Résilier le contrat' })
  terminate(@Param('id') id: string) { return this.contractsService.terminate(id) }

  // ─── Génération de documents commerciaux depuis le contrat ───
  @Post(':id/create-quotation')
  @ApiOperation({ summary: 'Générer un devis à partir du contrat' })
  createQuotation(@Param('id') id: string) { return this.contractsService.createQuotationFromContract(id) }

  @Post(':id/create-invoice')
  @ApiOperation({ summary: 'Générer une facture à partir du contrat' })
  createInvoiceFromContract(@Param('id') id: string) { return this.contractsService.createInvoiceFromContract(id) }
}
