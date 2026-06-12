import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PatrolsService } from './patrols.service'

@ApiTags('Patrols')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patrols')
export class PatrolsController {
  constructor(private patrols: PatrolsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des rondes' })
  findAll(
    @Query('siteId') siteId?: string,
    @Query('agentId') agentId?: string,
    @Query('state') state?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.patrols.findAll({ siteId, agentId, state, from, to })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une ronde' })
  findOne(@Param('id') id: string) { return this.patrols.findOne(id) }

  @Post('start')
  @ApiOperation({ summary: 'Démarrer une ronde' })
  start(@Body() body: { siteId: string; agentId: string; notes?: string }) {
    return this.patrols.start(body)
  }

  @Post(':id/scan')
  @ApiOperation({ summary: 'Scanner un point de contrôle pendant la ronde' })
  scan(@Param('id') id: string, @Body() body: any) {
    return this.patrols.scan(id, body)
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Terminer la ronde' })
  complete(@Param('id') id: string) { return this.patrols.complete(id) }

  @Post(':id/abort')
  @ApiOperation({ summary: 'Interrompre la ronde' })
  abort(@Param('id') id: string) { return this.patrols.abort(id) }
}
