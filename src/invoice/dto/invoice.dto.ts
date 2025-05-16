import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Max, Min } from 'class-validator';

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
    lfi_id: string;
}

export class UpdateInvoiceValueDto {
    @ApiProperty({
        description: 'status update to PAID/UNPAID',
        example: 1,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    value: number;

}

export class UpdateManyDto {

    @ApiProperty({
        description: 'Invoice ID',
        example: 'id',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    _id: string;

    @ApiProperty({
        description: 'status for invoice data.',
        example: 1,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    staus: number;

}