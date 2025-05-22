import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpStatus, ValidationPipe, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { ApiOperation } from '@nestjs/swagger';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }


  @ApiOperation({ summary: 'Create Users' })
  @Post()
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
  async findAll(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
    try {
      const result = await this.usersService.findAll(PaginationDTO);
      return {
        message: 'Success',
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
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
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
  async webPermissions(@Req() request: any) {
    try {
      // const users_id = request.user._id
      // console.log(users_id)
      const result = await this.usersService.getPermissionsUsingAccessToken('users_id')
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

}

