import { Controller, Get, HttpStatus, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { RoleService } from './role.service';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { SearchFilterDto } from './dto/create-role.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

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
}
