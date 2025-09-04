import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateTppDataDto {
    @ApiProperty({
        description: 'Brokerage fee for the TPP.',
        example: 2.99,
        // required: true,
    })
    @IsNumber()
    // @IsNotEmpty()
    brokerage_fee: number;

    @ApiProperty({
        description: 'Allow Nebras to collect Service Fee status.',
        example: false,
        required: true,
    })
    @IsBoolean()
    @IsNotEmpty()
    serviceStatus: boolean;
}