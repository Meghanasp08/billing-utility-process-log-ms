import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Put, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { commonDto, invoiceGenerateDto, InvoiceLfiEmailDto, InvoiceTppEmailDto, pdfGenerateLfiDto, pdfGenerateTppDto, UpdateInvoiceValueDto, UpdateManyDto } from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';
import { Claims } from 'src/common/claims/claims.decorator';
import { Claim } from 'src/common/claims/claim.enum';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) { }

  @ApiOperation({ summary: 'Get all Invoices and its details' })
  @Get()
  @Claims(Claim.INVOICE_TPP_VIEW)
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


  @Claims(Claim.INVOICE_LFI_VIEW)
  @ApiOperation({ summary: 'Get LFI details' })
  @Get('collection-memo')
  async findAllCollectionMemo(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
    try {
      const result = await this.invoiceService.findAllCollectionMemo(PaginationDTO);
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

  @Claims(Claim.INVOICE_LFI_VIEW)
  @ApiOperation({ summary: 'Get single LFI details' })
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

  @Claims(Claim.INVOICE_TPP_EDIT)
  @ApiOperation({ summary: 'Update invoice status to PAID/UNPAID' })
  @Patch('update-invoice/:id')
  async updateInvoiceData(@Req() req: any, @Param('id') id: string, @Body() updateInvoiceValueDto: UpdateInvoiceValueDto,) {
    try {
      const invoiceData = await this.invoiceService.updateInvoiceData(id, updateInvoiceValueDto);
      return {
        message: 'Invoice data updated successfully',
        result: invoiceData,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({ summary: 'Bulk Update for InvoiceData' })
  @Claims(Claim.INVOICE_TPP_EDIT)
  @Put('bulk-update')
  async bulkUpdate(@Body() data: UpdateManyDto[]) {
    const invoiceData = await this.invoiceService.bulkUpdate(data);
    return {
      message: 'Invoice Data Updates successfully',
      result: invoiceData,
      statusCode: HttpStatus.OK
    }
  }

  @ApiOperation({ summary: ' Update Many  for InvoiceData' })
  @Patch('update-many')
  @Claims(Claim.INVOICE_TPP_EDIT)
  async updateManyInvoices(@Body() body: any) {
    const invoiceData = await this.invoiceService.updateManyInvoices(body);
    return {
      message: 'Invoice Data Updates successfully',
      result: invoiceData,
      statusCode: HttpStatus.OK
    }
  }

  @ApiOperation({ summary: 'Generate invoices from logs' })
  @Post()
  @Claims(Claim.INVOICE_TPP_CREATE)
  async invoiceCreation(@Body(ValidationPipe) invoiceDto: invoiceGenerateDto,): Promise<any> {
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

  @ApiOperation({ summary: 'Generate invoices from logs' })
  @Post('invoice-tpp-csv')
  async invoiceTppCsv(@Res() res: Response,@Body(ValidationPipe) invoiceDto: invoiceGenerateDto,): Promise<any> {
    try {
      const result = await this.invoiceService.invoiceTppCsv(invoiceDto);
      res.download('./output/log_detail.csv', 'Log Detail.csv', (err) => {
        if (err) {
          console.error('Error while downloading file:', err);
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
        }
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('invoice-lfi-csv')
  async invoiceLfiCsv(@Res() res: Response,@Body(ValidationPipe) invoiceDto: invoiceGenerateDto,): Promise<any> {
    try {
      const result = await this.invoiceService.invoiceLfiCsv(invoiceDto);
      res.download('./output/log_detail.csv', 'Log Detail.csv', (err) => {
        if (err) {
          console.error('Error while downloading file:', err);
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
        }
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Its not functional' })
  // @Post('single-day-creation')
  async invoiceCreationSingleDay(@Body(ValidationPipe) invoiceDto: any,): Promise<any> {
    try {
      const result = await this.invoiceService.invoiceCreationSingleDay('tpp');
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

  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Its not functional' })
  // @Post('monthly-creation')
  async invoiceCreationMonthlyTpp(@Body(ValidationPipe) invoiceDto: any,): Promise<any> {
    try {
      const result = await this.invoiceService.invoiceCreationMonthlyTpp('gg');
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


  @ApiOperation({ summary: 'Get single Invoice data' })
  @Get(':id')
  @Claims(Claim.INVOICE_TPP_VIEW)
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

  @ApiOperation({ summary: 'Billing API for a TPP' })
  @Get('billing-tpp/:tpp_id')
  @Claims(Claim.BILLING_TPP_VIEW)
  async getbillingTpps(@Param('tpp_id') tpp_id: string, @Query(ValidationPipe) invoiceDto: commonDto): Promise<any> {
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

  @ApiOperation({ summary: 'Billing API for a TPP' })
  @Get('billing-tpp-csv/:tpp_id')
  @Claims(Claim.BILLING_TPP_VIEW)
  async getbillingTppCSV(@Res() res: Response,@Param('tpp_id') tpp_id: string, @Query(ValidationPipe) invoiceDto: commonDto): Promise<any> {
    try {
      const result = await this.invoiceService.billingTppCsv(tpp_id, invoiceDto);
      res.download('./output/log_detail.csv', 'Log Detail.csv', (err) => {
        if (err) {
          console.error('Error while downloading file:', err);
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
        }
      });
     
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Billing API for a LFI' })
  @Get('billing-lfi/:lf_id')
  @Claims(Claim.BILLING_LFI_VIEW)
  async getbillingLfis(@Param('lf_id') lf_id: string, @Query(ValidationPipe) invoiceDto: commonDto): Promise<any> {
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

  @ApiOperation({ summary: 'Billing API for a LFI' })
  @Get('billing-lfi-csv/:lf_id')
  @Claims(Claim.BILLING_LFI_VIEW)
  async getbillingLfisCSV(@Res() res: Response,@Param('lf_id') lf_id: string, @Query(ValidationPipe) invoiceDto: commonDto): Promise<any> {
    try {
      const result = await this.invoiceService.billingLfiStatementCSV(lf_id, invoiceDto);
      res.download('./output/log_detail.csv', 'Log-LFI Detail.csv', (err) => {
        if (err) {
          console.error('Error while downloading file:', err);
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
        }
      });
     
    } catch (error) {
      console.log(error);
      throw error;
    }
  }


  @ApiOperation({ summary: 'PDF generate for a TPP' })
  @Post('pdf-generate-tpp')
  @Claims(Claim.INVOICE_TPP_DOWNLOAD)
  async generateInvoicePDFTpp(@Body(ValidationPipe) invoiceDto: pdfGenerateTppDto, @Res() res: Response
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


  @ApiOperation({ summary: 'PDF generate for a LFI' })
  @Post('pdf-generate-lfi')
  @Claims(Claim.INVOICE_LFI_DOWNLOAD)
  async generateInvoicePDFLfi(@Body(ValidationPipe) invoiceDto: pdfGenerateLfiDto, @Res() res: Response
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

  @Claims(Claim.INVOICE_TPP_DOWNLOAD)
  @Post('send-tpp-invoice')
  async sendInvoiceTppEmail(
    @Body(ValidationPipe) emailDto: InvoiceTppEmailDto,
  ): Promise<any> {
    try {
      let mail = true;
      const result = await this.invoiceService.generateInvoicePDFTpp(emailDto, mail);
      return { message: 'Email sent successfully', result };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }


  @Post('send-lfi-invoice')
  @Claims(Claim.INVOICE_LFI_DOWNLOAD)
  async sendInvoiceLfiEmail(
    @Body(ValidationPipe) emailDto: InvoiceLfiEmailDto,
  ): Promise<any> {
    try {
      let mail = true;
      const result = await this.invoiceService.generateInvoicePDFLfi(emailDto, mail);
      return { message: 'Email sent successfully', result };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

}
