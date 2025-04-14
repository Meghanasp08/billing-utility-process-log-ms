import { Controller, Get, HttpStatus, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve the profile of the logged-in user.' })
  @Get()
  async getProfile(@Req() req: any) {
    try {
      const users = await this.profileService.getProfile();
      return {
        message: 'List of users',
        result: users,
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
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for filtering logs.' })
  @Get('log')
  async getLogData(@Req() req: any, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string, @Query('search') search?: string, @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0) {
    try {
      const logData = await this.profileService.getLogData(startDate, endDate, search, limit, offset);
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
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for filtering billing data.' })
  @Get('billing/lfi')
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
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for filtering billing data.' })
  @Get('billing/tpp')
  async getBillingTppData(@Req() req: any, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string, @Query('search') search?: string) {
    try {
      const group = 'tpp'
      const logData = await this.profileService.getBillingData(group, startDate, endDate, search);
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
  @ApiParam({ name: 'id', description: 'The unique ID of the LFI bill.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for billing details (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for billing details (YYYY-MM-DD).' })
  @Get('billingdetail/lfi/:id')
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
  @ApiParam({ name: 'id', description: 'The unique ID of the TPP bill.' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for billing details (YYYY-MM-DD).' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for billing details (YYYY-MM-DD).' })
  @Get('billingdetail/tpp/:id')
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
  @ApiOperation({ summary: 'Retrieve detailed billing hub fee data for a specific ID.' })
  @ApiParam({ name: 'id', description: 'The unique identifier for the billing hub fee record.' })
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
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for LFI details.' })
  @Get('lfidetails')
  async getLfiDetails(@Query('search') search?: string) {
    try {
      const logData = await this.profileService.getLfiDetails(search);
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
  @ApiQuery({ name: 'search', required: false, description: 'Search keyword for TPP details.' })
  @Get('tppdetails')
  async getTppDetails(@Query('search') search?: string) {
    try {
      const logData = await this.profileService.getTppDetails(search);
      return {
        message: 'Tpp Details',
        result: logData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

}
