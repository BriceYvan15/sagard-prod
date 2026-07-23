import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TreasuryService } from './treasury.service'

@ApiTags('Trésorerie')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private treasury: TreasuryService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Lister tous les comptes de trésorerie' })
  findAll() {
    return this.treasury.findAll()
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Détail d\'un compte avec transactions' })
  findOne(@Param('id') id: string) {
    return this.treasury.findOne(id)
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Créer un compte de trésorerie' })
  create(@Body() body: { name: string; type: string; bankName?: string; accountNumber?: string; paymentMethods?: string[] }) {
    return this.treasury.create(body)
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Modifier un compte de trésorerie' })
  update(@Param('id') id: string, @Body() body: { name?: string; bankName?: string; accountNumber?: string; paymentMethods?: string[]; isActive?: boolean }) {
    return this.treasury.update(id, body)
  }

  @Post('accounts/:id/debit')
  @ApiOperation({ summary: 'Débiter un compte (dépense/retrait)' })
  debit(@Param('id') id: string, @Body() body: { amount: number; description?: string; reference?: string }) {
    return this.treasury.debit(id, body)
  }

  @Post('accounts/:id/credit')
  @ApiOperation({ summary: 'Créditer un compte (dépôt/autre revenu)' })
  manualCredit(@Param('id') id: string, @Body() body: { amount: number; description?: string; reference?: string }) {
    return this.treasury.manualCredit(id, body)
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfert entre comptes' })
  transfer(@Body() body: { fromId: string; toId: string; amount: number; description?: string }) {
    return this.treasury.transfer(body.fromId, body.toId, body.amount, body.description)
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Toutes les transactions (option: filtrer par compte)' })
  transactions(@Query('accountId') accountId?: string, @Query('limit') limit?: string) {
    return this.treasury.getAllTransactions(accountId, limit ? +limit : 100)
  }

  @Post('seed')
  @ApiOperation({ summary: 'Initialiser les comptes par défaut' })
  seed() {
    return this.treasury.seedDefaults()
  }
}
