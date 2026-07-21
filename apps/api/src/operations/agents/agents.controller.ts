import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { AgentsService } from './agents.service'
import { AuditService } from '../../audit/audit.service'

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private agentsService: AgentsService, private audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des agents' })
  findAll(
    @Query('status') status?: string,
    @Query('shift') shift?: string,
    @Query('search') search?: string,
  ) {
    return this.agentsService.findAll({ status, shift, search })
  }

  @Get('absences/today')
  @ApiOperation({ summary: 'Absences du jour' })
  todayAbsences() {
    return this.agentsService.getTodayAbsences()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail agent' })
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Créer un agent (rattachement utilisateur existant)' })
  create(@Body() body: any) {
    return this.agentsService.create(body)
  }

  @Post('with-user')
  @ApiOperation({ summary: 'Créer un agent avec un nouveau compte utilisateur' })
  createWithUser(@Body() body: any) {
    return this.agentsService.createWithUser(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un agent' })
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const old = await this.agentsService.findOne(id)
    const updated = await this.agentsService.update(id, body)
    await this.audit.log({ userId: req.user?.sub, action: 'UPDATE', entity: 'Agent', entityId: id, oldData: old, newData: body })
    return updated
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Désactiver un agent' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const old = await this.agentsService.findOne(id)
    const result = await this.agentsService.deactivate(id)
    await this.audit.log({ userId: req.user?.sub, action: 'DELETE', entity: 'Agent', entityId: id, oldData: old })
    return result
  }

  @Post(':id/terminate')
  @ApiOperation({ summary: 'Mettre fin au contrat (renvoi) avec motif' })
  async terminate(@Param('id') id: string, @Body() body: { reason: string }, @Request() req: any) {
    const old = await this.agentsService.findOne(id)
    const result = await this.agentsService.terminate(id, body.reason, req.user?.sub)
    await this.audit.log({ userId: req.user?.sub, action: 'DELETE', entity: 'Agent', entityId: id, oldData: old, newData: { reason: body.reason } })
    return result
  }

  @Post(':id/equipments')
  @ApiOperation({ summary: 'Assigner un équipement' })
  assignEquipment(@Param('id') id: string, @Body() body: { equipmentId: string; notes?: string }) {
    return this.agentsService.assignEquipment(id, body.equipmentId, body.notes)
  }
}
