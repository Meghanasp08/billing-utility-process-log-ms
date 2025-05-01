import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber } from "class-validator";

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