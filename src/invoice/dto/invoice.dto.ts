import { IsInt, IsNotEmpty, IsPositive, IsString, Max, Min } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class InvoiceTppEmailDto {
    @ApiProperty({
        description: 'Month for the invoice (1-12)',
        example: 5,
        minimum: 1,
        maximum: 12,
    })
    @IsInt()
    @IsPositive()
    @Min(1)
    @Max(12)
    month: number;

    @ApiProperty({
        description: 'Year for the invoice',
        example: 2020,
    })
    @IsInt()
    @IsPositive()
    year: number;

    @ApiProperty({
        description: 'TPP ID for the invoice',
        example: '345266',
    })
    @IsString()
    @IsNotEmpty()
    tpp_id: string;
}

export class InvoiceLfiEmailDto {
    @ApiProperty({
        description: 'Month for the invoice (1-12)',
        example: 5,
        minimum: 1,
        maximum: 12,
    })
    @IsInt()
    @IsPositive()
    @Min(1)
    @Max(12)
    month: number;

    @ApiProperty({
        description: 'Year for the invoice',
        example: 2020,
    })
    @IsInt()
    @IsPositive()
    year: number;

    @ApiProperty({
        description: 'TPP ID for the invoice',
        example: '345266',
    })
    @IsString()
    @IsNotEmpty()
    tpp_id: string;
}