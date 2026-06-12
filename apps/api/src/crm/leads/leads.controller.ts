import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { LeadsService } from './leads.service'

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private svc: LeadsService) {}

  @Get()
  findAll(
    @Request() req: any,
    @Query('stage') stage?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('priority') priority?: string,
  ) {
    const user = req.user
    const createdById = user?.role === 'COMMERCIAL' ? user.id : undefined
    return this.svc.findAll({ stage, assignedToId, priority, createdById })
  }

  @Get('stats')
  getPipelineStats() {
    return this.svc.getPipelineStats()
  }

  @Get('commercial-stats')
  getCommercialStats() {
    return this.svc.getCommercialStats()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id)
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.svc.create({ ...body, createdById: req.user?.id ?? body.createdById })
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body)
  }

  @Post(':id/qualify')
  qualify(@Param('id') id: string) {
    return this.svc.qualify(id)
  }

  @Post(':id/propose')
  propose(@Param('id') id: string) {
    return this.svc.propose(id)
  }

  @Post(':id/negotiate')
  negotiate(@Param('id') id: string) {
    return this.svc.negotiate(id)
  }

  @Post(':id/win')
  win(@Param('id') id: string) {
    return this.svc.win(id)
  }

  @Post(':id/lose')
  lose(@Param('id') id: string, @Body() body: any) {
    return this.svc.lose(id, body?.reason)
  }

  @Post(':id/convert')
  convertToClient(@Param('id') id: string, @Body() body: any) {
    return this.svc.convertToClient(id, body)
  }

  @Post(':id/activities')
  addActivity(@Param('id') id: string, @Body() body: any) {
    return this.svc.addActivity(id, body)
  }

  @Get(':id/activities')
  getActivities(@Param('id') id: string) {
    return this.svc.getActivities(id)
  }
}
