import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get() getMyNotifications(@Request() req: any) { return this.notificationsService.getUserNotifications(req.user.id) }
  @Get('unread-count') getUnreadCount(@Request() req: any) { return this.notificationsService.getUnreadCount(req.user.id) }
  @Patch(':id/read') markRead(@Param('id') id: string, @Request() req: any) { return this.notificationsService.markRead(id, req.user.id) }
  @Patch('read-all') markAllRead(@Request() req: any) { return this.notificationsService.markAllRead(req.user.id) }
}
