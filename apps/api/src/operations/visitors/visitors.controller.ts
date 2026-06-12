import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common'
import { VisitorsService } from './visitors.service'

@Controller('visitors')
export class VisitorsController {
  constructor(private svc: VisitorsService) {}

  @Get()
  findAll(@Query('siteId') siteId?: string) {
    return this.svc.findAll(siteId)
  }

  @Get('blacklist')
  getBlacklist(@Query('siteId') siteId?: string) {
    return this.svc.getBlacklist(siteId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id)
  }

  @Post()
  create(@Body() body: any) {
    return this.svc.create(body)
  }

  @Post(':id/checkout')
  checkOut(@Param('id') id: string) {
    return this.svc.checkOut(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body)
  }

  @Post('blacklist')
  addToBlacklist(@Body() body: any) {
    return this.svc.addToBlacklist(body)
  }

  @Post('blacklist/:id/remove')
  removeFromBlacklist(@Param('id') id: string) {
    return this.svc.removeFromBlacklist(id)
  }
}
