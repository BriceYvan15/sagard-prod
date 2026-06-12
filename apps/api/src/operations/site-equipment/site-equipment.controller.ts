import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common'
import { SiteEquipmentService } from './site-equipment.service'

@Controller('site-equipment')
export class SiteEquipmentController {
  constructor(private svc: SiteEquipmentService) {}

  @Get()
  findAll(
    @Query('siteId') siteId?: string,
    @Query('category') category?: string,
    @Query('state') state?: string,
  ) {
    return this.svc.findAll({ siteId, category, state })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id)
  }

  @Post()
  create(@Body() body: any) {
    return this.svc.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body)
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: any) {
    return this.svc.assign(id, body)
  }

  @Post(':id/return')
  returnEquipment(@Param('id') id: string, @Body() body: any) {
    return this.svc.returnEquipment(id, body)
  }

  @Post(':id/maintenance')
  sendToMaintenance(@Param('id') id: string, @Body() body: any) {
    return this.svc.sendToMaintenance(id, body)
  }

  @Post(':id/lost')
  declareLost(@Param('id') id: string, @Body() body: any) {
    return this.svc.declareLost(id, body)
  }

  @Get(':id/movements')
  getMovements(@Param('id') id: string) {
    return this.svc.getMovements(id)
  }
}
