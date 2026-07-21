import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsNumber } from 'class-validator'

export class CheckInDto {
  @ApiProperty({ enum: ['JOUR', 'NUIT', 'MIXTE'] })
  @IsString()
  shift: string

  @ApiPropertyOptional({ description: 'URL photo (optionnel - prise caméra)' })
  @IsOptional()
  @IsString()
  photoUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string

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