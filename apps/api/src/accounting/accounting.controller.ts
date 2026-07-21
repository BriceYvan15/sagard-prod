import { Controller, Get, Post, Patch, Delete, Query, Body, Param, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AccountingService } from './accounting.service'

@ApiTags('Comptabilité')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private accounting: AccountingService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord financier annuel' })
  getDashboard(@Query('year') year?: string) {
    return this.accounting.getDashboard(year ? +year : undefined)
  }

  @Get('journal')
  @ApiOperation({ summary: 'Journal comptable (écritures)' })
  getJournal(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('type') type?: string,
  ) {
    return this.accounting.getJournal({
      year: year ? +year : undefined,
      month: month ? +month : undefined,
      type,
    })
  }

  @Get('treasury')
  @ApiOperation({ summary: 'Trésorerie mensuelle' })
  getTreasury(@Query('year') year?: string) {
    return this.accounting.getTreasury(year ? +year : undefined)
  }

  @Post('payments/:invoiceId')
  @ApiOperation({ summary: 'Enregistrer un paiement sur une facture' })
  registerPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { amount?: number; paymentDate?: string; paymentMethod?: string; reference?: string },
    @Request() req: any,
  ) {
    return this.accounting.registerPayment(invoiceId, body, req.user?.id)
  }

  @Get('unpaid-invoices')
  @ApiOperation({ summary: 'Factures impayées / en retard' })
  getUnpaidInvoices() {
    return this.accounting.getUnpaidInvoices()
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Saisir une charge/dépense manuelle' })
  recordExpense(
    @Body() body: { description: string; amount: number; account: string; date?: string; reference?: string; category?: string },
    @Request() req: any,
  ) {
    return this.accounting.recordExpense(body, req.user?.id)
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Liste des dépenses manuelles' })
  getExpenses(@Query('year') year?: string, @Query('month') month?: string) {
    return this.accounting.getExpenses(year ? +year : undefined, month ? +month : undefined)
  }

  // ── Plan comptable (Chart of Accounts) ───────────────────
  @Get('accounts')
  @ApiOperation({ summary: 'Liste des comptes du plan comptable' })
  getAccounts() {
    return this.accounting.getAccounts()
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Ajouter un compte au plan comptable' })
  createAccount(@Body() body: { code: string; label: string }) {
    return this.accounting.createAccount(body)
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Modifier un compte du plan comptable' })
  updateAccount(@Param('id') id: string, @Body() body: { code?: string; label?: string }) {
    return this.accounting.updateAccount(id, body)
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Supprimer un compte du plan comptable' })
  deleteAccount(@Param('id') id: string) {
    return this.accounting.deleteAccount(id)
  }

  @Post('accounts/reset')
  @ApiOperation({ summary: 'Réinitialiser le plan comptable avec les comptes SYSCOHADA par défaut' })
  resetAccounts() {
    return this.accounting.resetAccounts()
  }
}
