import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AuditService } from './audit.service'

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Historique des modifications (filtré par rôle)' })
  getHistory(
    @Request() req: any,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.getHistory({
      entity,
      entityId,
      userId,
      userRole: req.user?.role,
      page: page ? +page : 1,
      limit: limit ? +limit : 50,
    })
  }

  @Get(':entity/:entityId')
  @ApiOperation({ summary: 'Historique d\'un enregistrement spécifique' })
  getEntityHistory(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.audit.getEntityHistory(entity, entityId)
  }
}
