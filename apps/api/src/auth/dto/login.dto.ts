import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'dg@sagard.ci' })
  @IsEmail()
  email: string

  @ApiProperty({ example: '********' })
  @IsString()
  @MinLength(6)
  password: string
}
