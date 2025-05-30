import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpStatus, ValidationPipe, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { Claims } from 'src/common/claims/claims.decorator';
import { Claim } from 'src/common/claims/claim.enum';
import { ClaimsGuard } from 'src/common/claims/claims.guard';

@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard,ClaimsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }


  @ApiOperation({ summary: 'Create a User' })
  @Post()
  @Claims(Claim.USER_CREATE)
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const result = await this.usersService.create(createUserDto);
      return {
        message: 'User created successfully',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get all Users and its details' })
  @Get()
  @Claims(Claim.USER_VIEW)
  async findAll(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
    try {
      const result = await this.usersService.findAll(PaginationDTO);
      return {
        message: 'The list of users',
        result: result?.result,
        statusCode: HttpStatus.OK,
        pagination: result?.pagination,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get Users By ID' })
  @Get(':id')
  @Claims(Claim.USER_VIEW)
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.usersService.findOne(id);
      return {
        message: 'Success',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Update Users data' })
  @Patch(':id')
  @Claims(Claim.USER_EDIT)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      console.log("EDIT")
      const result = await this.usersService.update(id, updateUserDto);
      return {
        message: 'Success',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('/web-permissions')
  @ApiOperation({ summary: 'Get permissions for a user' })
  async webPermissions(@Req() request: any) {
    try {
      const users_id = request.user.userId
      const result = await this.usersService.getPermissionsUsingAccessToken(users_id)
      return {
        message: 'Web Permission List',
        result: result,
        statusCode: HttpStatus.OK
      }
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @ApiOperation({ summary: 'Send Activatiom Mail for the User' })
  @Post('/send-activation-mail')
  @Claims(Claim.USER_EDIT)
  async sendActivationEmail(@Body() data:any) {
    try {
      const result = await this.usersService.sendActivationEmail(data);
      return {
        message: 'Mail successfully',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  

}

