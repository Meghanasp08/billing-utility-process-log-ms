import { ApiProperty } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"

export class PaginationDTO {
    @ApiProperty({
        description: 'Offset',
        type: String,
        required: false
    })
    @IsOptional()
    @IsString()
    offset: string

    @ApiProperty({
        description: 'Limit',
        type: Number,
        required: false
    })
    @IsOptional()
    @IsString()
    limit: string

    @ApiProperty({
        description: 'Status',
        type: String,
        required: false
    })
    @IsOptional()
    @IsString()
    status: string

    @ApiProperty({
        description: 'Search',
        type: String,
        required: false
    })
    @IsOptional()
    @IsString()
    search: string

    fromDate: Date
    toDate: Date
    month:Number
    year:Number
    invoice_status:Number
}