import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ApiCategory, KeyName } from "../enum/api-data.enum";

export class UpdateglobalValueDto {
    @ApiProperty({
        description: 'value for global data in AED.',
        example: 2.5,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    value: number;

    data: any
}

export class GetglobalValueDto {
    @ApiProperty({
        description: 'key for global data.',
        example: 'email',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    key: string;
}

export class UpdateManyDto {

    @ApiProperty({
        description: 'Global ID',
        example: 'id',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    _id: string;

    @ApiProperty({
        description: 'value for global data in AED.',
        example: 2.5,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    value: number;

    data: any;
}

export class UpdateApiDto {
    @ApiProperty({
        description: 'Unique identifier for the API.',
        example: '67ffa4f5982cf875de9ef8b2',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    _id: string;

    @ApiProperty({
        description: 'The full URL constructed from api_spec and api_endpoint.',
        example: '/open-finance/payment/v1.0/payment-consents/{ConsentId}',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    url: string;

    @ApiProperty({
        description: 'The operation type for the API (e.g., GET, POST).',
        example: 'get',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    api_operation: string;

    @ApiProperty({
        description: 'Indicates if the API Hub fee is chargeable.',
        example: true,
        required: true,
    })
    @IsBoolean()
    chargeable_api_hub_fee: boolean;

    @ApiProperty({
        description: 'Indicates if the LFI/TPP fee is chargeable.',
        example: false,
        required: true,
    })
    @IsBoolean()
    chargeable_LFI_TPP_fee: boolean;

    // @ApiProperty({
    //     description: 'The key name associated with this API.',
    //     example: 'setup',
    //     required: true,
    // })
    // @IsString()
    // @IsNotEmpty()
    // key_name: string;

    @ApiProperty({
        description: 'The key name for the API.',
        enum: KeyName,
        example: KeyName.SETUP,

    })
    @IsEnum(KeyName, { message: 'key must be one of the predefined key names.' })
    key: KeyName;

    // @ApiProperty({
    //     description: 'The category under which the API is classified.',
    //     example: 'Setup and Consent',
    //     required: true,
    // })
    // @IsString()
    // @IsNotEmpty()
    // api_category: string;

    @ApiProperty({
        description: 'The API category for the operation.',
        enum: ApiCategory,
        example: ApiCategory.SETUP_AND_CONSENT,
    })
    @IsEnum(ApiCategory, { message: 'apiCategory must be a valid enum value.' })
    apiCategory: ApiCategory;
}
