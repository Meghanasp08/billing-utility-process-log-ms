import { Controller, Get, HttpStatus, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @Get('log')
  async getLogData(@Req() req: any, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string, @Query('search') search?: string) {
    try {
      const logData = await this.profileService.getLogData(startDate, endDate, search);
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
  @Get('billing/lfi')
  async getBillingLfiData(@Req() req: any, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string, @Query('search') search?: string) {
    try {
      const group = 'lfi'
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
  @Get('billing/tpp')
  async getBillingTppData(@Req() req: any, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    try {
      const group = 'tpp'
      const logData = await this.profileService.getBillingData(group, startDate, endDate);
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
