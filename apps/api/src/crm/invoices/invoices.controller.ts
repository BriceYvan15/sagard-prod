import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { InvoicesService } from './invoices.service'

@ApiTags('CRM — Facturation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste factures/devis/proforma' })
  findAll(
    @Query('clientId') clientId?: string,
    @Query('status')   status?: string,
    @Query('type')     type?: string,
    @Query('month')    month?: string,
  ) {
    return this.invoicesService.findAll({ clientId, status, type, month })
  }

  @Get('service-catalog')
  @ApiOperation({ summary: 'Catalogue des désignations de services' })
  getServiceCatalog() {
    return this.invoicesService.getServiceCatalog()
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques facturation' })
  getStats() {
    return this.invoicesService.getStats()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Créer facture / devis / proforma' })
  create(@Body() body: any) {
    return this.invoicesService.create(body)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Changer le statut (envoyer, accepter, refuser...)' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.invoicesService.updateStatus(id, body.status)
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Marquer comme payée' })
  markPaid(@Param('id') id: string, @Body() body: { paymentMethod: string }) {
    return this.invoicesService.markPaid(id, body.paymentMethod)
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convertir devis/proforma en facture' })
  convert(@Param('id') id: string) {
    return this.invoicesService.convertToInvoice(id)
  }

  @Post('generate-monthly')
  @ApiOperation({ summary: 'Générer les factures mensuelles de tous les contrats actifs' })
  generateMonthly() {
    return this.invoicesService.generateMonthlyInvoices()
  }

  @Post('check-overdue')
  @ApiOperation({ summary: 'Mettre à jour le statut des factures en retard' })
  checkOverdue() {
    return this.invoicesService.markOverdue()
  }
}
