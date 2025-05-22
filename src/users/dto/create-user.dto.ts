import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateUserDto {

    @ApiProperty({
        description: 'name of the role',
        type: String,
        required: true
    })
    @IsString()
    @IsNotEmpty()
    readonly firstName: string = ''

    @ApiProperty({
        description: 'name of the role',
        type: String,
        required: true
    })
    @IsString()
    @IsNotEmpty()
    readonly lastName: string = ''

    password: any

    @ApiProperty({
        description: ' email',
        type: String,
        required: false
    })
    @IsString()
    @IsOptional()
    readonly email: string = ''

    @ApiProperty({
        description: ' username',
        type: String,
        required: false
    })
    @IsString()
    @IsOptional()
    readonly username: string = ''

    @ApiProperty({
        description: 'mobile',
        type: String,
        required: false
    })
    @IsString()
    @IsOptional()
    readonly mobile: string = ''

    
    role:any

    createdBy: any

}

