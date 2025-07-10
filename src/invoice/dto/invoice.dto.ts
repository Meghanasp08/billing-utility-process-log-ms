import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Max, Min } from 'class-validator';

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
        description: 'LFI ID for the invoice',
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

export class invoiceGenerateDto {

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

    tpp_id:string

    lfi_id:string

}

export class commonDto {

    @ApiProperty({
        description: 'Start date in YYYY-MM-DD format',
        example: '2020-05-01',
        required: true,
    })
    @IsNotEmpty()
    @IsDateString()
    startDate: string;

    @ApiProperty({
        description: 'End date in YYYY-MM-DD format',
        example: '2020-05-31',
        required: true,
    })
    @IsNotEmpty()
    @IsDateString()
    endDate: string;

}

export class pdfGenerateTppDto {

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

export class pdfGenerateLfiDto {

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
        description: 'LFI ID for the invoice',
        example: '345266',
    })
    @IsString()
    @IsNotEmpty()
    lfi_id: string;

}