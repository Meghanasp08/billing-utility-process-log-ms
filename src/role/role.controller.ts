import { Controller, Get, HttpStatus, Query, ValidationPipe } from '@nestjs/common';
import { RoleService } from './role.service';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { SearchFilterDto } from './dto/create-role.dto';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

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
