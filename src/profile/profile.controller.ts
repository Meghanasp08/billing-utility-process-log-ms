import { Body, Controller, Get, HttpStatus, Param, Post, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { Claim } from 'src/common/claims/claim.enum';
import { Claims } from 'src/common/claims/claims.decorator';
import { ChangePasswordDto } from './dto/profile.dto';
import { QueryParametersDTO } from './dto/query-parameter.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Claims(Claim.USER_VIEW)
  @ApiOperation({ summary: 'Retrieve the profile of the logged-in user.' })
  @Get()
  async getProfile(@Req() request: any) {
    try {
      const users_id = request.user.userId
      const result = await this.profileService.getProfile(users_id);
      return {
        message: 'Profile of the logged-in user',
        result: result,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve log data based on date range and search query.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date of the logs (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date of the logs (YYYY-MM-DD).' })
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for filtering logs (TPP id, LFI Id, TPP Name , LFI Name).' })
  @Get('log')
  @Claims(Claim.LOG_VIEW)
  async getLogData(@Req() req: any, @Query(ValidationPipe) queryParameter: QueryParametersDTO) {
    try {
      const logData = await this.profileService.getLogData(
        queryParameter
      );
      return {
        message: 'List of Logs',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @Post('logs')
  @Claims(Claim.LOG_VIEW)
  async getLogDataWithAllFilter(@Req() req: any, @Body(ValidationPipe) queryBody: any, ) {
    try {
      const logData = await this.profileService.getLogDataNew(
        queryBody
      );
      return {
        message: 'List of Logs',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve billing data for LFI group.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for billing data (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for billing data (YYYY-MM-DD).' })
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for filtering billing data (TPP id, LFI Id, TPP Name , LFI Name).' })
  @Get('billing/lfi')
  @Claims(Claim.BILLING_LFI_VIEW)
  async getBillingLfiData(@Req() req: any, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string, @Query('search') search?: string, @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0) {
    try {
      const group = 'lfi'
      const logData = await this.profileService.getBillingData(group, startDate, endDate, search, limit, offset);
      return {
        message: 'List of Bills',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve billing data for TPP group.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for billing data (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for billing data (YYYY-MM-DD).' })
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for filtering billing data (TPP id, LFI Id, TPP Name , LFI Name).' })
  @Get('billing/tpp')
  @Claims(Claim.BILLING_TPP_VIEW)
  async getBillingTppData(@Req() req: any, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string, @Query('search') search?: string, @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0) {
    try {
      const group = 'tpp'
      const logData = await this.profileService.getBillingData(group, startDate, endDate, search, limit, offset);
      return {
        message: 'List of Bills',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve detailed billing data for LFI by ID.' })
  @ApiParam({ name: 'id', description: 'The unique LFI ID of the LFI bill.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for billing details (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for billing details (YYYY-MM-DD).' })
  @Get('billingdetail/lfi/:id')
  @Claims(Claim.BILLING_LFI_VIEW)
  async getBillingDetailsLfi(@Param('id') id: string, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    try {
      const group: any = 'lfi'
      const logData = await this.profileService.getBillingDetails(id, group, startDate, endDate);
      return {
        message: 'Bill Details',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve detailed billing data for TPP by ID.' })
  @ApiParam({ name: 'id', description: 'The unique TPP ID of the TPP bill.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for billing details (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for billing details (YYYY-MM-DD).' })
  @Get('billingdetail/tpp/:id')
  @Claims(Claim.BILLING_TPP_VIEW)
  async getBillingDetailsTpp(@Param('id') id: string, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    try {
      const group: any = 'tpp'

      const logData = await this.profileService.getBillingDetails(id, group, startDate, endDate);
      return {
        message: 'Bill Details',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }


  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve detailed billing hub fee data for a specific TPP ID.' })
  @ApiParam({ name: 'id', description: 'The TPP ID for getting the billing hub fee record.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for the hub fee details (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for the hub fee details (YYYY-MM-DD).' })
  @Get('apihubfee/:id')
  async getBillingHubDetails(@Param('id') id: string, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    try {
      const logData = await this.profileService.getBillingHubDetails(id, startDate, endDate);
      return {
        message: 'Hub Fee Details',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve details of LFI.' })
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for LFI details (LFI Id , LFI Name).' })
  @Get('lfidetails')
  @Claims(Claim.LFI_DIRECTORY_VIEW)
  async getLfiDetails(@Query('search') search?: string, @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0) {
    try {
      const logData = await this.profileService.getLfiDetails(search, limit, offset);
      return {
        message: 'Lfi Details',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve details of TPP.' })
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for TPP details (TTP Id , TPP Name).' })
  @Get('tppdetails')
  @Claims(Claim.TPP_CONFIGURATION_VIEW)
  async getTppDetails(@Query('search') search?: string, @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0) {
    try {
      const logData = await this.profileService.getTppDetails(search, limit, offset);
      return {
        message: 'Tpp Details',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve log csv data based on date range and search query .' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date of the logs (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date of the logs (YYYY-MM-DD).' })
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for filtering logs (TPP id, LFI Id, TPP Name , LFI Name).' })
  @Get('log/csv')
  @Claims(Claim.LOG_DOWNLOAD)
  async getLogDataToCsv(@Req() req: any, @Res() res: Response, @Query(ValidationPipe) queryParameters: QueryParametersDTO) {
    try {
      const logData = await this.profileService.getLogDataToCSV(queryParameters);
      // return {
      //   message: 'List of Logs',
      //   result: logData,
      //   statusCode: HttpStatus.OK
      // }
      res.download('./output/log_data.csv', 'Merged-data.csv', (err) => {
        if (err) {
          console.error('Error while downloading file:', err);
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
        }
      });
    } catch (error) {
      throw error;
    }
  }


  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  async changePassword(@Body(ValidationPipe) changePasswordDto: ChangePasswordDto, @Req() req: any): Promise<any> {
    try {
      const users_id = req.user.userId
      const result = await this.profileService.changePassword(changePasswordDto, users_id);
      return {
        message: 'Password changed successfully',
        result: result,
        statusCode: HttpStatus.OK
      }
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}
