import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class UpdateglobalValueDto {
    @ApiProperty({
        description: 'value for global data in AED.',
        example: 2.5,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    value: number;
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

    data:any;
}