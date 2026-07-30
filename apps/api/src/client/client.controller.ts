import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Role } from '@prisma/client'
import { ClientService } from './client.service'

@ApiTags('Client Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT)
@Controller('client')
export class ClientController {
  constructor(private clientService: ClientService) {}

  @Get('sites')
  @ApiOperation({ summary: 'Mes sites avec agents assignés et statut en poste' })
  getMySites(@Request() req: any) {
    return this.clientService.getMySites(req.user.sub ?? req.user.id)
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Mes factures' })
  getMyInvoices(@Request() req: any) {
    return this.clientService.getMyInvoices(req.user.sub ?? req.user.id)
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Détail d\'une facture' })
  getInvoiceDetail(@Request() req: any, @Param('id') id: string) {
    return this.clientService.getInvoiceDetail(req.user.sub ?? req.user.id, id)
  }
}
