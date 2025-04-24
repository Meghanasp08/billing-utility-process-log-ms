import { Body, Controller, Get, HttpStatus, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { ConfigurationService } from './configuration.service';
import { UpdateLfiDataDto } from './dto/lfi_update.dto';

@ApiTags('configuration')
@Controller('configuration')
export class ConfigurationController {
    constructor(private readonly configService: ConfigurationService) { }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update Lfi details like MDP rate and Attended unattended calls.' })
    @Patch('lfi/:id')
    async updateLfiData(@Req() req: any, @Param('id') id: string, @Body() updateLfiDataDto: UpdateLfiDataDto,) {
        try {
            const lfiData = await this.configService.updateLfiData(id, updateLfiDataDto);
            return {
                message: 'Lfi data updated successfully',
                result: lfiData,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;
        }
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update Lfi details like MDP rate and Attended unattended calls.' })
    @Patch('global/:id')
    async updateGlobalData(@Req() req: any, @Param('id') id: string,) {
        try {
            // const lfiData = await this.configService.updateGlobalData(id, updateLfiDataDto);
            return {
                message: 'Lfi data updated successfully',
                result: 'lfiData',
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;
        }
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update Lfi details like MDP rate and Attended unattended calls.' })
    @Get('global')
    async GetGlobalData(@Req() req: any,) {
        try {
            const globalData = await this.configService.getGlobalData();
            return {
                message: 'Global Data Fetched successfully',
                result: globalData,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;
        }
    }
}
