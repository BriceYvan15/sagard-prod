import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Res, UploadedFile, UseInterceptors, Request } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { InvoicesService } from './invoices.service'
import { MailService } from '../../mail/mail.service'

@ApiTags('CRM — Facturation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private invoicesService: InvoicesService,
    private mailService: MailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste factures/devis/proforma' })
  findAll(
    @Request() req: any,
    @Query('clientId') clientId?: string,
    @Query('status')   status?: string,
    @Query('type')     type?: string,
    @Query('month')    month?: string,
  ) {
    return this.invoicesService.findAll({ clientId, status, type, month }, req.user)
  }

  @Get('service-catalog')
  @ApiOperation({ summary: 'Catalogue des désignations de services' })
  getServiceCatalog() {
    return this.invoicesService.getServiceCatalog()
  }

  @Post('service-catalog')
  @ApiOperation({ summary: 'Ajouter une désignation au catalogue' })
  @Roles('DIRECTEUR_GENERAL', 'COMMERCIAL')
  @UseGuards(RolesGuard)
  createCatalogItem(@Body() body: { code: string; description: string; unitPrice?: number }) {
    return this.invoicesService.createCatalogItem(body)
  }

  @Post('service-catalog/reset')
  @ApiOperation({ summary: 'Réinitialiser le catalogue avec la liste par défaut' })
  @Roles('DIRECTEUR_GENERAL')
  @UseGuards(RolesGuard)
  resetCatalog() {
    return this.invoicesService.resetCatalog()
  }

  @Patch('service-catalog/:id')
  @ApiOperation({ summary: 'Modifier une désignation du catalogue' })
  @Roles('DIRECTEUR_GENERAL', 'COMMERCIAL')
  @UseGuards(RolesGuard)
  updateCatalogItem(@Param('id') id: string, @Body() body: { description?: string; unitPrice?: number; isActive?: boolean }) {
    return this.invoicesService.updateCatalogItem(id, body)
  }

  @Delete('service-catalog/:id')
  @ApiOperation({ summary: 'Supprimer une désignation du catalogue' })
  @Roles('DIRECTEUR_GENERAL')
  @UseGuards(RolesGuard)
  deleteCatalogItem(@Param('id') id: string) {
    return this.invoicesService.deleteCatalogItem(id)
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

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger le PDF de la facture' })
  async downloadPdf(@Param('id') id: string, @Res() res: any) {
    try {
      const { buffer, filename } = await this.mailService.downloadInvoicePdf(id)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(buffer)
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Erreur lors de la génération du PDF' })
    }
  }

  @Post()
  @ApiOperation({ summary: 'Créer facture / devis / proforma' })
  create(@Request() req: any, @Body() body: any) {
    return this.invoicesService.create(body, req.user)
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

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une facture (DG uniquement)' })
  @Roles('DIRECTEUR_GENERAL')
  @UseGuards(RolesGuard)
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une facture (DG uniquement)' })
  @Roles('DIRECTEUR_GENERAL')
  @UseGuards(RolesGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.invoicesService.update(id, body)
  }

  @Post('check-overdue')
  @ApiOperation({ summary: 'Mettre à jour le statut des factures en retard' })
  checkOverdue() {
    return this.invoicesService.markOverdue()
  }

  @Post(':id/send-email')
  @ApiOperation({ summary: 'Envoyer la facture par e-mail au client' })
  async sendEmail(@Param('id') id: string) {
    try {
      return await this.mailService.sendInvoiceEmail(id)
    } catch (err: any) {
      const status = err?.status ?? 500
      const message = err?.message ?? 'Erreur lors de l\'envoi de l\'email'
      console.error('[send-email] Error:', message, err?.stack)
      throw err
    }
  }

  @Post(':id/send-email-with-attachment')
  @ApiOperation({ summary: 'Envoyer la facture par e-mail avec une pièce jointe supplémentaire' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  sendEmailWithAttachment(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) {
      return this.mailService.sendInvoiceEmail(id)
    }
    return this.mailService.sendInvoiceEmailWithAttachment(id, {
      filename: file.originalname,
      content: file.buffer,
    })
  }
}
