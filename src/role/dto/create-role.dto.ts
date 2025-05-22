import { ApiProperty } from "@nestjs/swagger"
import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, ValidateNested, IsNumber, IsMongoId } from "class-validator"
import { Schema } from 'mongoose'
export class PermissionsDTO {
    @ApiProperty({
        description: 'Permissions ID',
        type: Schema.Types.ObjectId,
        required: true,
        example: '61d487b25447240d56627372'
    })
    @IsMongoId()
    @IsNotEmpty()
    readonly id: Schema.Types.ObjectId

    @ApiProperty({
        description: 'Permission Name',
        type: String,
        required: true
    })
    @IsString()
    @IsNotEmpty()
    readonly name: string

    @ApiProperty({
        description: 'Access ',
        type: Boolean,
        required: true
    })
    @IsNotEmpty()
    readonly access: boolean

    @ApiProperty({
        description: 'Authorize',
        type: Boolean,
        required: true
    })
    @IsNotEmpty()
    readonly authorize: boolean

    @ApiProperty({
        description: 'Create',
        type: Boolean,
        required: true
    })
    @IsNotEmpty()
    readonly create: boolean

    @ApiProperty({
        description: 'View',
        type: Boolean,
        required: true
    })
    @IsNotEmpty()
    readonly view: boolean

    @ApiProperty({
        description: 'Edit',
        type: Boolean,
        required: true
    })
    @IsNotEmpty()
    readonly edit: boolean

    @ApiProperty({
        description: 'Delete',
        type: String,
        required: true
    })
    @IsNotEmpty()
    readonly delete: string
}
export class CreateRoleDto {
    @ApiProperty({
        description: 'name of the role',
        type: String,
        required: true
    })
    @IsString()
    @IsNotEmpty()
    readonly name: string = ''

    @ApiProperty({
        description: 'description of the role',
        type: String,
        required: false
    })
    @IsString()
    @IsOptional()
    readonly description: string = ''

    isFacilityUser: any

    @ApiProperty({
        description: 'Permissions of a role',
        type: PermissionsDTO,
        required: true,
        example: [
            {
                id: '',
                name: 'Entity Onboarding',
                access: true,
                authorize: true,
                create: true,
                view: true,
                edit: true,
                delete: true
            }
        ]
    })
    @IsNotEmpty()
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested()
    readonly permissions: [PermissionsDTO]

    createdBy: any

    @ApiProperty({
        description: 'type of the role',
        type: String,
        required: true
    })
    @IsNotEmpty()
    @IsString()
    readonly roleType: string
}

export class SearchFilterDto {
    @ApiProperty({
      description: 'search',
      type: String,
      required: false
    })
    @IsString()
    @IsOptional()
    readonly search: string
  
    @ApiProperty({
      description: 'Status',
      type: Boolean,
      required: false
    })
    @IsOptional()
    readonly status: boolean

    roleType:string

    @ApiProperty({
        description: 'description',
        type: String,
        required: false
      })
    @IsOptional()
    description:string

    
  }

  