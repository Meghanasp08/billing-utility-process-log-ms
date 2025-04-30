import { Body, Controller, Get, HttpStatus, Param, Post, Query, Res, ValidationPipe } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { PaginationDTO } from 'src/common/dto/common.dto';
import * as path from 'path';
import { Response } from 'express';
import * as fs from 'fs';

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

  @Post('pdf-generate-tpp')
  async generateInvoicePDFTpp(@Body(ValidationPipe) invoiceDto: any, @Res() res: Response
  ): Promise<any> {
    try {
      const filePath = await this.invoiceService.generateInvoicePDFTpp(invoiceDto);
      const fileName = path.basename(filePath); // gets 'invoice-lfi{timestamp}.pdf'

      return res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Download error:', err);
        }

        // Remove the file after sending response
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting PDF file:', unlinkErr);
          } else {
            console.log(`Deleted temp PDF: ${filePath}`);
          }
        });
      });
    } catch (error) {
      console.log(error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate invoice PDF',
        error: error.message,
      });
    }
  }

  @Post('pdf-generate-lfi')
  async generateInvoicePDFLfi(@Body(ValidationPipe) invoiceDto: any, @Res() res: Response
  ): Promise<any> {
    try {
      const filePath = await this.invoiceService.generateInvoicePDFLfi(invoiceDto);
      const fileName = path.basename(filePath); 

      return res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Download error:', err);
        }

        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting PDF file:', unlinkErr);
          } else {
            console.log(`Deleted temp PDF: ${filePath}`);
          }
        });
      });

    } catch (error) {
      console.log(error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate invoice PDF',
        error: error.message,
      });
    }
  }
}
