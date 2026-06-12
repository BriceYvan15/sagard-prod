import { Controller, Get, Post, Param, Body, Query, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { AlertsService } from './alerts.service'

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Get()        findAll(@Query() q: any) { return this.alerts.findAll(q) }
  @Get(':id')   findOne(@Param('id') id: string) { return this.alerts.findOne(id) }
  @Post()       create(@Body() body: any) { return this.alerts.create(body) }

  @Post(':id/acknowledge')  @ApiOperation({ summary: 'Prendre en compte une alerte' })
  acknowledge(@Param('id') id: string, @Request() req: any) {
    return this.alerts.acknowledge(id, req.user?.sub ?? 'system')
  }
  @Post(':id/intervention') @ApiOperation({ summary: 'Démarrer intervention' })
  intervention(@Param('id') id: string) { return this.alerts.intervention(id) }
  @Post(':id/resolve')      @ApiOperation({ summary: 'Marquer l\'alerte résolue' })
  resolve(@Param('id') id: string) { return this.alerts.resolve(id) }
  @Post(':id/false')        @ApiOperation({ summary: 'Marquer comme fausse alerte' })
  markFalse(@Param('id') id: string) { return this.alerts.markFalse(id) }
  @Post(':id/convert')      @ApiOperation({ summary: 'Convertir en incident' })
  convert(@Param('id') id: string) { return this.alerts.convertToIncident(id) }
}
