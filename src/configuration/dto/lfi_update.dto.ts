import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateLfiDataDto {
    @ApiProperty({
        description: 'MDP Rate for the LFI.',
        example: 2.99,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    mdp_rate: number;

    @ApiProperty({
        description: 'Free limit for attended calls.',
        example: 15,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    free_limit_attended: number;

    @ApiProperty({
        description: 'Free limit for unattended calls.',
        example: 5,
        required: true,
    })
    @IsNumber()
    @IsNotEmpty()
    free_limit_unattended: number;
}
