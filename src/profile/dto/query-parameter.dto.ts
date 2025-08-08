import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryParametersDTO {
    @ApiPropertyOptional({
        description: 'Start date for filtering (ISO format recommended)',
        type: String,
        example: '2023-01-01',
    })
    @IsOptional()
    @IsString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for filtering (ISO format recommended)',
        type: String,
        example: '2023-12-31',
    })
    @IsOptional()
    @IsString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Search keyword for filtering results',
        type: String,
        example: 'example search term',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Number of items to return (pagination limit)',
        type: Number,
        example: 100,
        default: 100,
    })
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value, 10))
    limit: number = 100;

    @ApiPropertyOptional({
        description: 'Offset for pagination',
        type: Number,
        example: 0,
        default: 0,
    })
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value, 10))
    offset: number = 0;

    @ApiPropertyOptional({
        description: 'Group by a specific key',
        type: String,
        example: 'payment-bulk',
    })
    @IsOptional()
    @IsString()
    group?: string;

    @ApiPropertyOptional({
        description: 'Filter by a specific type',
        type: String,
        example: 'merchant',
    })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({
        description: 'Filter for LFI chargeable items',
        type: Boolean,
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    lfiChargable?: boolean;

    @ApiPropertyOptional({
        description: 'Filter for API chargeable items',
        type: Boolean,
        example: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    apiChargeable?: boolean;

    @ApiPropertyOptional({
        description: 'Filter for API success items',
        type: Boolean,
        example: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    success?: boolean;

    @ApiPropertyOptional({
        description: 'Filter for API duplicate items',
        type: Boolean,
        example: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    duplicate?: boolean;
}
