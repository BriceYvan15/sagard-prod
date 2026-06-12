import { Controller, Get, Post, Query, Body, Param, UseGuards, Request } from '@nestjs/common'
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
    return this.accounting.registerPayment(invoiceId, body, req.user?.sub)
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
    return this.accounting.recordExpense(body, req.user?.sub)
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Liste des dépenses manuelles' })
  getExpenses(@Query('year') year?: string, @Query('month') month?: string) {
    return this.accounting.getExpenses(year ? +year : undefined, month ? +month : undefined)
  }
}
