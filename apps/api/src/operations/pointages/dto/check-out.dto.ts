import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsNumber } from 'class-validator'

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'URL photo (optionnel - fin de service)' })
  @IsOptional()
  @IsString()
  photoUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}