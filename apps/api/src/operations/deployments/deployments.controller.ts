import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { DeploymentsService } from './deployments.service'

@ApiTags('Deployments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deployments')
export class DeploymentsController {
  constructor(private deployments: DeploymentsService) {}

  @Get()
  @ApiOperation({ summary: "Liste des affectations d'agents" })
  findAll(
    @Query('siteId') siteId?: string,
    @Query('agentId') agentId?: string,
    @Query('state') state?: string,
    @Query('contractId') contractId?: string,
  ) {
    return this.deployments.findAll({ siteId, agentId, state, contractId })
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une affectation" })
  findOne(@Param('id') id: string) { return this.deployments.findOne(id) }

  @Post()
  @ApiOperation({ summary: 'Créer une affectation' })
  create(@Body() body: any) { return this.deployments.create(body) }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une affectation' })
  update(@Param('id') id: string, @Body() body: any) { return this.deployments.update(id, body) }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activer une affectation (BROUILLON → ACTIF)' })
  activate(@Param('id') id: string) { return this.deployments.activate(id) }

  @Post(':id/end')
  @ApiOperation({ summary: 'Terminer une affectation' })
  end(@Param('id') id: string) { return this.deployments.end(id) }

  @Post(':id/replace')
  @ApiOperation({ summary: "Remplacer l'agent affecté par un autre" })
  replace(@Param('id') id: string, @Body() body: { replacementAgentId: string; startDate?: string }) {
    return this.deployments.replace(id, body)
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: "Muter l'agent vers un autre site (avec motif)" })
  transfer(@Param('id') id: string, @Body() body: { toSiteId: string; motif: string; transferDate?: string }) {
    return this.deployments.transfer(id, body)
  }
}
