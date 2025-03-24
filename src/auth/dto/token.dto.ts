import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class getAccessTokenUsingRefreshTokenDto {
    @ApiProperty({ description: 'token' })
    @IsString()
    @IsNotEmpty()
    readonly refresh_token: string = '';
  }