import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TransfersService } from './transfers.service'

@ApiTags('Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private transfers: TransfersService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des mutations (avec filtres optionnels)' })
  findAll(@Query('agentId') agentId?: string, @Query('fromSiteId') fromSiteId?: string, @Query('toSiteId') toSiteId?: string) {
    return this.transfers.findAll({ agentId, fromSiteId, toSiteId })
  }

  @Get('agent/:agentId')
  @ApiOperation({ summary: "Historique des mutations d'un agent" })
  findByAgent(@Param('agentId') agentId: string) {
    return this.transfers.findByAgent(agentId)
  }
}
