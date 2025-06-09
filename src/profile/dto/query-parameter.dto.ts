import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryParametersDTO {
    @IsOptional()
    @IsString()
    startDate?: string;

    @IsOptional()
    @IsString()
    endDate?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value, 10))
    limit: number = 100;

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value, 10))
    offset: number = 0;

    @IsOptional()
    @IsString()
    group?: string;

    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true') // Convert string to boolean
    lfiChargable?: boolean;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true') // Convert string to boolean
    apiChargeable?: boolean;
}
