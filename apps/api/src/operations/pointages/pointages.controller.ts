import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PointagesService } from './pointages.service'

@ApiTags('Pointages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pointages')
export class PointagesController {
  constructor(private pointagesService: PointagesService) {}

  @Get('today')
  @ApiOperation({ summary: 'Pointages du jour' })
  getToday(
    @Query('siteId') siteId?: string,
    @Query('shift') shift?: string,
  ) {
    return this.pointagesService.getTodayPointages({ siteId, shift })
  }

  @Get('report')
  @ApiOperation({ summary: 'Rapport journalier' })
  getReport(
    @Query('date') date: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.pointagesService.getDailyReport(new Date(date), siteId)
  }

  @Get('by-date')
  @ApiOperation({ summary: 'Pointages d\'une date spécifique' })
  getByDate(
    @Query('date') date: string,
    @Query('siteId') siteId?: string,
    @Query('shift') shift?: string,
  ) {
    return this.pointagesService.getPointagesByDate(new Date(date), { siteId, shift })
  }

  @Get('range')
  @ApiOperation({ summary: 'Pointages sur une plage de dates' })
  getRange(
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('siteId') siteId?: string,
    @Query('shift') shift?: string,
  ) {
    return this.pointagesService.getPointagesRange(new Date(start), new Date(end), { siteId, shift })
  }

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'Pointages d\'un agent' })
  getAgentPointages(
    @Param('agentId') agentId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.pointagesService.getAgentPointages(agentId, new Date(start), new Date(end))
  }

  @Post('checkin')
  @ApiOperation({ summary: 'Prise de poste' })
  checkIn(@Request() req: any, @Body() body: any) {
    return this.pointagesService.checkIn(req.user.agentId ?? req.user.sub, body)
  }

  @Post(':id/checkout')
  @ApiOperation({ summary: 'Fin de poste' })
  checkOut(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.pointagesService.checkOut(req.user.agentId ?? req.user.sub, id, body)
  }

  @Patch(':id/position')
  @ApiOperation({ summary: 'Mise à jour position GPS (tracking horaire)' })
  updatePosition(@Param('id') id: string, @Request() req: any, @Body() body: { latitude?: number; longitude?: number }) {
    return this.pointagesService.updatePosition(req.user.agentId ?? req.user.sub, id, body)
  }

  @Post('generate-daily')
  @ApiOperation({ summary: 'Générer les pointages du jour à partir des déploiements actifs (cron)' })
  generateDaily(@Body() body: { date?: string }) {
    return this.pointagesService.generateDailyAttendance(body?.date ? new Date(body.date) : undefined)
  }
}
