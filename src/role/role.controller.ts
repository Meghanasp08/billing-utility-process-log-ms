import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { RoleService } from './role.service';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { CreateRoleDto, SearchFilterDto } from './dto/create-role.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Post()
  // @Claims(Claim.ROLE_CREATE)
  async create(
    @Body(ValidationPipe) createRoleDto: CreateRoleDto,
    @Req() request: any
  ) {
    try {

      const result = await this.roleService.create(createRoleDto)
      return {
        message: 'Success',
        result: result,
        statusCode: HttpStatus.OK,
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get Role Data' })
  @Get()
  async findAll(
    @Query(ValidationPipe) PaginationDTO: PaginationDTO
  ) {
    try {
      const result = await this.roleService.findAll(PaginationDTO)
      return {
        message: 'Success', 
        result: result?.result,
        statusCode: HttpStatus.OK,
        pagination: result?.pagination
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get Role Data' })
  @Get('/list-all')
  async findAllList(
    @Query(ValidationPipe) data: SearchFilterDto,
    @Query(ValidationPipe) PaginationDTO: PaginationDTO
  ) {
    try {
      const result = await this.roleService.findAllList(data, PaginationDTO)
      return {
        message: 'Success',
        result: result,
        statusCode: HttpStatus.OK,
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get('/permissions')
  async findfindAllPermissionAll(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
    try {
      const result = await this.roleService.findAllPermission(PaginationDTO)
      return {
        message: 'Success',
        result: result,
        statusCode: HttpStatus.OK,
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get(':id')
  // @Claims(Claim.ROLE_VIEW)
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.roleService.findOne(id)
      return {
        message: 'Success',
        result: result,
        statusCode: HttpStatus.OK,
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Patch(':id')
  // @Claims(Claim.ROLE_EDIT)
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: any,
    @Req() request: any
  ) {
    try {
      const result = await this.roleService.update(id, updateRoleDto)
      return {
        message: 'Success',
        result: result,
        statusCode: HttpStatus.OK,
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
