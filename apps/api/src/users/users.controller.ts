import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Role } from '@prisma/client'

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS, Role.COMMERCIAL)
  findAll(@Query('role') role?: Role, @Query('status') status?: string) {
    return this.usersService.findAll({ role, status })
  }

  @Get(':id')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Post()
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH)
  create(@Body() body: any) {
    return this.usersService.create(body)
  }

  @Patch(':id')
  @Roles(Role.DIRECTEUR_GENERAL)
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.usersService.update(id, body, req.user?.id)
  }

  @Patch(':id/suspend')
  @Roles(Role.DIRECTEUR_GENERAL)
  suspend(@Param('id') id: string) {
    return this.usersService.suspend(id)
  }

  @Patch(':id/activate')
  @Roles(Role.DIRECTEUR_GENERAL)
  activate(@Param('id') id: string) {
    return this.usersService.activate(id)
  }
}
