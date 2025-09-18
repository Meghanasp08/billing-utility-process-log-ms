import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

// Nested DTO for configuration_fee
export class ConfigurationFeeDto {

    @ApiProperty({
        description: 'Fee for Motor',
        example: 100,
        required: true,
    })
    @IsNumber()
    motor: number;

    @ApiProperty({
        description: 'Fee for Rent ',
        example: 200,
        required: true,
    })
    @IsNumber()
    renter: number;

    @ApiProperty({
        description: 'Fee for Travel ',
        example: 300,
        required: true,
    })
    @IsNumber()
    travel: number;

    @ApiProperty({
        description: 'Fee for Insurance ',
        example: 400,
        required: true,
    })
    @IsNumber()
    home: number;

    @ApiProperty({
        description: 'Fee for Health ',
        example: 500,
        required: true,
    })
    @IsNumber()
    health: number;

    @ApiProperty({
        description: 'Fee for Life ',
        example: 500,
        required: true,
    })
    @IsNumber()
    life: number;

    @ApiProperty({
        description: 'Fee for employment_ILO ',
        example: 500,
        required: true,
    })
    @IsNumber()
    employment_ILO: number;
}

// Main DTO
export class CreateGlobalConfigurationDto {
    @ApiProperty({
        description: 'Tpp ID',
        example: '12345',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    tpp_id: string;

    @ApiProperty({
        description: 'LFI ID',
        example: '67890',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    lfi_id: string;

    @ApiProperty({
        description: 'Type of configuration',
        example: 'insurance',
        required: false,
        default: 'insurance',
    })
    @IsString()
    @IsOptional()
    type?: string = 'insurance';

    @ApiProperty({
        description: 'Configuration fee details',
        type: () => ConfigurationFeeDto,
        required: true,
    })
    @ValidateNested()
    @Type(() => ConfigurationFeeDto)
    configuration_fee: ConfigurationFeeDto;

    @ApiProperty({
        description: 'Status of configuration',
        example: true,
        required: false,
        default: true,
    })
    @IsBoolean()
    @IsOptional()
    serviceStatus?: boolean = true;
}
