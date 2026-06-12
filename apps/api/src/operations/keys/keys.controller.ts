import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common'
import { KeysService } from './keys.service'

@Controller('keys')
export class KeysController {
  constructor(private svc: KeysService) {}

  @Get()
  findAll(@Query('siteId') siteId?: string) {
    return this.svc.findAll(siteId)
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

  @Post(':id/issue')
  issueKey(@Param('id') id: string, @Body() body: any) {
    return this.svc.issueKey(id, body)
  }

  @Post(':id/return')
  returnKey(@Param('id') id: string, @Body() body: any) {
    return this.svc.returnKey(id, body)
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
