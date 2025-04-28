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

  @Get('collection-memo')
  async findAllCollectionMemo(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
    try {
      const result = await this.invoiceService.findAllCollectionMemo(PaginationDTO);
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

  @Get('collection-memo/:id')
  async findCollectionMemoById(@Param('id') id: string) {
    try {
      const result = await this.invoiceService.findCollectionMemoById(id);
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
  
  @Post('single-day-creation')
  async invoiceCreationSingleDay(@Body(ValidationPipe) invoiceDto: any,): Promise<any> {
    try {
      const result = await this.invoiceService.invoiceCreationSingleDay();
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
    
  @Post('monthly-creation')
  async invoiceCreationMonthlyTpp(@Body(ValidationPipe) invoiceDto: any,): Promise<any> {
    try {
      const result = await this.invoiceService.invoiceCreationMonthlyTpp();
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

  @Get('billing-tpp/:tpp_id')
  async getbillingTpps(@Param('tpp_id') tpp_id: string, @Query(ValidationPipe) invoiceDto: any): Promise<any> {
    try {
      const result = await this.invoiceService.billingTpp(tpp_id, invoiceDto);
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

  @Get('billing-lfi/:lf_id')
  async getbillingLfis(@Param('lf_id') lf_id: string, @Query(ValidationPipe) invoiceDto: any): Promise<any> {
    try {
      const result = await this.invoiceService.billingLfiStatement(lf_id, invoiceDto);
      return {
        message: 'Lfi Details',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

}
