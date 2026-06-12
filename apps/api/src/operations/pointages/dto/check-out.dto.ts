import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator'

export class CheckOutDto {
  @ApiProperty({ description: 'URL photo obligatoire (fin de service)' })
  @IsString()
  @IsNotEmpty()
  photoUrl: string

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
