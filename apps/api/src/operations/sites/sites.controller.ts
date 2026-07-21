import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { SitesService } from './sites.service'
import { AuditService } from '../../audit/audit.service'

@ApiTags('Sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sites')
export class SitesController {
  constructor(private sitesService: SitesService, private audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des sites' })
  findAll(
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('siteType') siteType?: string,
    @Query('riskLevel') riskLevel?: string,
  ) {
    return this.sitesService.findAll({ clientId, status, siteType, riskLevel })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail site' })
  findOne(@Param('id') id: string) {
    return this.sitesService.findOne(id)
  }

  @Get(':id/pointages/today')
  @ApiOperation({ summary: 'Pointages du jour pour un site' })
  todayPointages(@Param('id') id: string) {
    return this.sitesService.getTodayPointages(id)
  }

  @Post()
  @ApiOperation({ summary: 'Créer un site' })
  create(@Body() body: any) {
    return this.sitesService.create(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un site' })
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const old = await this.sitesService.findOne(id)
    const updated = await this.sitesService.update(id, body)
    await this.audit.log({ userId: req.user?.sub, action: 'UPDATE', entity: 'Site', entityId: id, oldData: old, newData: body })
    return updated
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Désactiver un site' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const old = await this.sitesService.findOne(id)
    const result = await this.sitesService.deactivate(id)
    await this.audit.log({ userId: req.user?.sub, action: 'DELETE', entity: 'Site', entityId: id, oldData: old })
    return result
  }

  @Post(':id/agents')
  @ApiOperation({ summary: 'Affecter un agent au site (crée un AgentDeployment)' })
  assignAgent(@Param('id') siteId: string, @Body() body: any) {
    return this.sitesService.assignAgent(siteId, body)
  }

  @Post(':id/agents/:agentId/remove')
  @ApiOperation({ summary: 'Retirer un agent du site' })
  removeAgent(@Param('id') siteId: string, @Param('agentId') agentId: string) {
    return this.sitesService.removeAgent(siteId, agentId)
  }

  // ─── Points de contrôle de ronde ──────────────────────────────────
  @Get(':id/patrol-points')
  @ApiOperation({ summary: 'Liste des points de contrôle (QR) du site' })
  listPatrolPoints(@Param('id') siteId: string) {
    return this.sitesService.listPatrolPoints(siteId)
  }

  @Post(':id/patrol-points')
  @ApiOperation({ summary: 'Ajouter un point de contrôle au site' })
  addPatrolPoint(@Param('id') siteId: string, @Body() body: any) {
    return this.sitesService.addPatrolPoint(siteId, body)
  }

  @Patch('patrol-points/:pointId/disable')
  @ApiOperation({ summary: 'Désactiver un point de contrôle' })
  removePatrolPoint(@Param('pointId') pointId: string) {
    return this.sitesService.removePatrolPoint(pointId)
  }

  @Get('patrol-points/:pointId/qr')
  @ApiOperation({ summary: 'Badge QR (SVG) d\'un point de contrôle' })
  getPatrolPointQr(@Param('pointId') pointId: string) {
    return this.sitesService.getPatrolPointQr(pointId)
  }

  @Get(':id/patrol-points/qr-sheet')
  @ApiOperation({ summary: 'Planche imprimable (SVG) de tous les QR du site' })
  getPatrolPointsQrSheet(@Param('id') siteId: string) {
    return this.sitesService.getPatrolPointsQrSheet(siteId)
  }
}
