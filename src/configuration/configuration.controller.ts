import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { Claim } from 'src/common/claims/claim.enum';
import { Claims } from 'src/common/claims/claims.decorator';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { ConfigurationService } from './configuration.service';
import { CreateApiDto, GetglobalValueDto, UpdateApiDto, UpdateglobalValueDto, UpdateManyDto } from './dto/global_value.dto';
import { UpdateLfiDataDto } from './dto/lfi_update.dto';


@ApiTags('configuration')
@Controller('configuration')
export class ConfigurationController {
    constructor(private readonly configService: ConfigurationService) { }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update Lfi details like MDP rate and Attended unattended calls.' })
    @Patch('lfi/:id')
    @Claims(Claim.LFI_DIRECTORY_EDIT)
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
    @Claims(Claim.GLOBAL_CONFIGURATION_EDIT)
    async updateGlobalData(@Req() req: any, @Param('id') id: string, @Body() updateGlobalvalueDto: UpdateglobalValueDto,) {
        try {
            const globalData = await this.configService.updateGlobalData(id, updateGlobalvalueDto);
            return {
                message: 'global data updated successfully',
                result: globalData,
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
    @Claims(Claim.GLOBAL_CONFIGURATION_VIEW)
    async GetGlobalData(@Req() req: any, @Query('limit') limit: number = 10,
        @Query('offset') offset: number = 0) {
        try {
            const globalData = await this.configService.getGlobalData(limit, offset);
            return {
                message: 'Global Data Fetched successfully',
                result: globalData,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;
        }
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get the details with key filter' })
    @Get('global/single-data')
    @Claims(Claim.GLOBAL_CONFIGURATION_VIEW)
    async GetSingleData(@Req() req: any, @Query(ValidationPipe) getglobalValueDto: GetglobalValueDto) {
        try {
            const globalData = await this.configService.getSingleGlobalDataWithFilter(getglobalValueDto);
            return {
                message: 'Global Data Fetched successfully',
                result: globalData,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;
        }
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Bulk Update for GlobalData' })
    @Put('bulk-update')
    @Claims(Claim.GLOBAL_CONFIGURATION_EDIT)
    async bulkUpdate(@Body() data: UpdateManyDto[]) {
        const globalData = await this.configService.bulkUpdate(data);
        return {
            message: 'Global Data Updates successfully',
            result: globalData,
            statusCode: HttpStatus.OK
        }
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List details Of Api Data' })
    @Get('api-data')
    @Claims(Claim.GLOBAL_CONFIGURATION_VIEW)
    async getApiData(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
        const apiData = await this.configService.getApiData();
        return {
            message: 'Api Data List',
            result: apiData,
            statusCode: HttpStatus.OK
        }
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update the Api Data' })
    @Put('api-data')
    @Claims(Claim.GLOBAL_CONFIGURATION_EDIT)
    async updateApidata(@Body(ValidationPipe) updateApiDto: UpdateApiDto) {
        const apiData = await this.configService.updateApidatas(updateApiDto);
        return {
            message: 'Api Data Updated successfully',
            result: apiData,
            statusCode: HttpStatus.OK
        }
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create New Api Data' })
    @Post('api-data')
    @Claims(Claim.GLOBAL_CONFIGURATION_CREATE)
    async createApidata(@Body(ValidationPipe) createApiDto: CreateApiDto) {
        const apiData = await this.configService.createApidatas(createApiDto);
        return {
            message: 'Api Data Created successfully',
            result: apiData,
            statusCode: HttpStatus.OK
        }
    }
}
