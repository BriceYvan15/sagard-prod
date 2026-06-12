import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator'

export class CheckInDto {
  @ApiProperty({ enum: ['JOUR', 'NUIT', 'MIXTE'] })
  @IsString()
  shift: string

  @ApiProperty({ description: 'URL photo obligatoire (prise directe caméra)' })
  @IsString()
  @IsNotEmpty()
  photoUrl: string

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
