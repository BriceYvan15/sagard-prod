import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { IncidentsService } from './incidents.service'

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private incidents: IncidentsService) {}

  @Get()        findAll(@Query() q: any) { return this.incidents.findAll(q) }
  @Get(':id')   findOne(@Param('id') id: string) { return this.incidents.findOne(id) }
  @Post()       create(@Body() body: any) { return this.incidents.create(body) }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.incidents.update(id, body) }

  @Post(':id/investigate') @ApiOperation({ summary: "Passer en investigation" })
  investigate(@Param('id') id: string) { return this.incidents.investigate(id) }
  @Post(':id/resolve')     @ApiOperation({ summary: "Marquer résolu" })
  resolve(@Param('id') id: string, @Body() body: { resolution?: string }) { return this.incidents.resolve(id, body?.resolution) }
  @Post(':id/close')       @ApiOperation({ summary: "Clore l'incident" })
  close(@Param('id') id: string) { return this.incidents.close(id) }

  @Post(':id/agents')
  addAgent(@Param('id') id: string, @Body() body: { agentId: string; role?: string }) {
    return this.incidents.addAgent(id, body.agentId, body.role)
  }
  @Post(':id/agents/:agentId/remove')
  removeAgent(@Param('id') id: string, @Param('agentId') agentId: string) {
    return this.incidents.removeAgent(id, agentId)
  }
}
