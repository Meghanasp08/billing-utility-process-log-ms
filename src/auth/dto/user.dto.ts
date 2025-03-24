import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: "User's first name" })
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: "User's last name" })
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: "User's email address" })
  @IsEmail()
  email: string;

  @ApiProperty({ description: "User's password", minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: "User's mobile number" })
  @IsNotEmpty()
  mobile: string;

  @ApiProperty({ description: "User's refresh token", required: false })
  @IsOptional() 
  refreshToken?: string;
}
