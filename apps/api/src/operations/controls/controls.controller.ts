import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { ControlsService } from './controls.service'

@ApiTags('Control Visits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('controls')
export class ControlsController {
  constructor(private controls: ControlsService) {}

  @Get()       findAll(@Query() q: any) { return this.controls.findAll(q) }
  @Get(':id')  findOne(@Param('id') id: string) { return this.controls.findOne(id) }
  @Post()      create(@Body() body: any) { return this.controls.create(body) }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.controls.update(id, body) }

  @Post(':id/done')     @ApiOperation({ summary: 'Marquer la visite comme effectuée' })
  done(@Param('id') id: string) { return this.controls.markDone(id) }
  @Post(':id/reported') @ApiOperation({ summary: 'Reporter la visite' })
  reported(@Param('id') id: string) { return this.controls.markReported(id) }
  @Post(':id/cancel')   @ApiOperation({ summary: 'Annuler la visite' })
  cancel(@Param('id') id: string) { return this.controls.cancel(id) }
}
