import { Body, Controller, Get, HttpStatus, Param, Post, Query, ValidationPipe } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { PaginationDTO } from 'src/common/dto/common.dto';

@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) { }

  @Get()
  async findAllInvoices(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
    try {
      const result = await this.invoiceService.findAllInvoices(PaginationDTO);
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

  @Post()
  async invoiceCreation(@Body(ValidationPipe) invoiceDto: any,): Promise<any> {
    try {
      const result = await this.invoiceService.invoiceCreation(invoiceDto);
      return {
        message: 'Invoice Data',
        result: result,
        statusCode: HttpStatus.OK,
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get(':id')
  async getInvoiceDetails(@Param('id') id: string): Promise<any> {
    try {
      const result = await this.invoiceService.getInvoiceDetails(id);
      return {
        message: 'Invoice Details',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
