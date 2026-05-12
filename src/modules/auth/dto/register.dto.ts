import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'wanderer@prague.cz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'praguewanderer' })
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'username may only contain letters, digits, underscores, dots, hyphens',
  })
  username!: string;

  @ApiProperty({ example: 'CorrectHorseBatteryStaple!' })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  displayName?: string;
}
