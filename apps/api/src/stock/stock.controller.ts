import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { StockService } from './stock.service'

@ApiTags('Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private stockService: StockService) {}

  // ── Équipements ──
  @Get('equipments')
  @ApiOperation({ summary: 'Liste des équipements' })
  getEquipments(@Query('status') status?: string, @Query('category') category?: string) {
    return this.stockService.getEquipments({ status, category })
  }

  @Post('equipments')
  createEquipment(@Body() body: any) { return this.stockService.createEquipment(body) }

  @Patch('equipments/:id')
  updateEquipment(@Param('id') id: string, @Body() body: any) { return this.stockService.updateEquipment(id, body) }

  @Get('equipments/stats')
  equipmentStats() { return this.stockService.getEquipmentStats() }

  // ── Véhicules ──
  @Get('vehicles')
  @ApiOperation({ summary: 'Liste des véhicules' })
  getVehicles(@Query('status') status?: string, @Query('type') type?: string) {
    return this.stockService.getVehicles({ status, type })
  }

  @Post('vehicles')
  createVehicle(@Body() body: any) { return this.stockService.createVehicle(body) }

  @Patch('vehicles/:id')
  updateVehicle(@Param('id') id: string, @Body() body: any) { return this.stockService.updateVehicle(id, body) }

  // ── Carburant ──
  @Get('fuel')
  getFuelLogs(@Query('vehicleId') vehicleId?: string) { return this.stockService.getFuelLogs(vehicleId) }

  @Post('fuel')
  addFuelLog(@Body() body: any) { return this.stockService.addFuelLog(body) }

  @Get('fuel/stats')
  fuelStats(@Query('month') month?: string) { return this.stockService.getFuelStats(month) }
}
