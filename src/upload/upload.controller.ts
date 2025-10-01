import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
    Res,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    ValidationPipe
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { PaginationDTO } from 'src/common/dto/common.dto';

import { Claim } from 'src/common/claims/claim.enum';
import { Claims } from 'src/common/claims/claims.decorator';
import { UploadService } from './upload.service';


// Global processing flag
let isProcessing = false;
@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('input')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'raw_data', maxCount: 1 },
        { name: 'payment_data', maxCount: 1 },]))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload and merge files',
        description: 'This endpoint accepts two files: "Payment Log Data" and "Raw API Log Data". The files are validated, processed, merged, and the result will be upload in the database.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                raw_data: {
                    type: 'string',
                    format: 'binary',
                    description: 'Raw API Log Data file',
                },
                payment_data: {
                    type: 'string',
                    format: 'binary',
                    description: 'Payment Log Data file',
                },
            },
            required: ['raw_data',],
        },
    })
    @Claims(Claim.LOG_UPLOAD)
    async uploadFiles(@UploadedFiles() files: { raw_data?: Express.Multer.File[]; payment_data?: Express.Multer.File[]; }, @Req() req: any) {
        try {
            if (!files?.raw_data) {
                throw new HttpException('The "raw_data" file is required', HttpStatus.BAD_REQUEST);
            }
            // const raw_dataPath = files.raw_data[0].path;
            const raw_dataPath = files.raw_data[0].filename;
            const payment_dataPath = files?.payment_data?.[0]?.filename || "";
            const jobId = files.raw_data[0].filename;

            const result = await this.uploadService.mergeCsvFilesMicorservice(req.user.email, raw_dataPath, payment_dataPath, jobId);

            return result;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error; // Re-throw expected errors with proper status codes
            }

            const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            const errorMessage = error.message || 'Internal server error';

            throw new HttpException(
                {
                    message: errorMessage,
                    status: statusCode,
                    details: error.details || 'An unexpected error occurred.',
                },
                statusCode,
            );
        }
    }

    // @UseGuards(JwtAuthGuard)
    @Post('csv')
    @Claims(Claim.LOG_DOWNLOAD)
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'raw_data', maxCount: 1 },
        { name: 'payment_data', maxCount: 1 },]))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload and merge files And Download',
        description: 'This endpoint accepts two files: "Payment Log Data" and "Raw API Log Data". The files are validated, processed, merged, and the result will be COnverted to New csv File.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                raw_data: {
                    type: 'string',
                    format: 'binary',
                    description: 'Raw API Log Data file',
                },
                payment_data: {
                    type: 'string',
                    format: 'binary',
                    description: 'Payment Log Data file',
                },
            },
            required: ['raw_data', 'payment_data'],
        },
    })
    async uploadFilesForCsv(@UploadedFiles() files: { raw_data?: Express.Multer.File[]; payment_data?: Express.Multer.File[]; }, @Res() res: Response, @Req() req: any) {
        try {
            console.log('Uploaded files:', files);
            if (!files?.raw_data || !files?.payment_data) {
                throw new HttpException('Both files are required', HttpStatus.BAD_REQUEST);
            }

            const [raw_dataPath, payment_dataPath] = [
                files.raw_data[0].path,
                files.payment_data[0].path,
                // files.file3[0].path,
            ];
            const downloadCsv = true

            const mergedFilePath = await this.uploadService.mergeCsvFiles('byPass', raw_dataPath, payment_dataPath, downloadCsv);

            return res.download('./output/data.csv', 'merged-data.csv', (err) => {
                if (err) {
                    console.error('Error while downloading file:', err);
                    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
                }
            });
        } catch (error) {
            throw error;

        }
    }


    @ApiBearerAuth()
    @Get('raw-log/download/:id')
    @Claims(Claim.DATA_UPLOADER_DOWNLOAD)
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Download raw log file.' })
    async downloadRawLog(@Res() res: Response, @Param('id') id: string,) {
        try {
            const rawCsvPath = await this.uploadService.getRawLogCsv(id);
            return res.download(rawCsvPath, 'raw_log_data.csv', (err) => {
                if (err) {
                    console.error('Error while downloading file:', err);
                    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
                }
            });
        } catch (error) {
            throw error;
        }
    }

    @ApiBearerAuth()
    @Get('payment/download/:id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Download payment log file.' })
    @Claims(Claim.DATA_UPLOADER_DOWNLOAD)
    async downloadPaymentLog(@Res() res: Response, @Param('id') id: string,) {
        try {
            const paymentPath = await this.uploadService.getPaymentLogCsv(id);
            return res.download(paymentPath, 'payment_log_data.csv', (err) => {
                if (err) {
                    console.error('Error while downloading file:', err);
                    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
                }
            });
        } catch (error) {
            throw error;
        }
    }
    @ApiBearerAuth()
    @Get('input/log')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get upload log data' })
    @Claims(Claim.DATA_UPLOADER_VIEW)
    async getUploadLog(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
        try {
            let key = 'inputFiles';
            const uploadLog = await this.uploadService.getUploadLogData(key, PaginationDTO);
            return {
                message: 'Upload Log details',
                result: uploadLog,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error; // Re-throw expected errors with proper status codes
            }

            const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            const errorMessage = error.message || 'Internal server error';

            throw new HttpException(
                {
                    message: errorMessage,
                    status: statusCode,
                    details: error.details || 'An unexpected error occurred.',
                },
                statusCode,
            );
        }
    }

    @ApiBearerAuth()
    @Get('master/download/:id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Download Master Data file.' })
    @Claims(Claim.DATA_UPLOADER_DOWNLOAD)
    async downloadMaterData(@Res() res: Response, @Param('id') id: string,) {
        try {
            const masterData = await this.uploadService.getMasterLogCsv(id);
            return res.download(masterData, 'Master_Data.csv', (err) => {
                if (err) {
                    console.error('Error while downloading file:', err);
                    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to download file.');
                }
            });
        } catch (error) {
            throw error;
        }
    }
    @ApiBearerAuth()
    @Get('lfi-tpp/master/log')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get Master log data' })
    @Claims(Claim.DATA_UPLOADER_VIEW)
    async getMasterUploadLog(@Query(ValidationPipe) PaginationDTO: PaginationDTO) {
        try {
            let key = 'lfiTppMaster';
            const uploadLog = await this.uploadService.getUploadLogData(key, PaginationDTO);
            return {
                message: 'Master Log details',
                result: uploadLog,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error; // Re-throw expected errors with proper status codes
            }

            const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            const errorMessage = error.message || 'Internal server error';

            throw new HttpException(
                {
                    message: errorMessage,
                    status: statusCode,
                    details: error.details || 'An unexpected error occurred.',
                },
                statusCode,
            );
        }
    }
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('lfi-tpp/master')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'organization_data', maxCount: 1 },]))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload and Update LFI TPP',
        description: 'This endpoint accepts Organization file:  The files are validated, processed, and the result will be updated in the database.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                organization_data: {
                    type: 'string',
                    format: 'binary',
                    description: 'Organization Detail Data file',
                },
            },
            required: ['organization_data'],
        },
    })
    @Claims(Claim.GLOBAL_CONFIGURATION_UPLOAD)
    async uploadLfiTpp(@UploadedFiles() files: { organization_data?: Express.Multer.File[]; }, @Req() req: any) {
        try {
            if (!files?.organization_data) {
                throw new HttpException('file is required', HttpStatus.BAD_REQUEST);
            }

            const organizationFilePath = files.organization_data[0].path;
            const fileName = files.organization_data[0].originalname;

            const tppLfi = await this.uploadService.updateTppAndLfi(req.user.email, organizationFilePath, fileName);

            // unlink(organizationFilePath, (unlinkErr) => {
            //     if (unlinkErr) {
            //         console.error('Error deleting organization data file:', unlinkErr);
            //     } else {
            //         console.log(`Deleted temp organization data file: ${organizationFilePath}`);
            //     }
            // });
            return {
                message: 'Organization data processed successfully.',
                result: tppLfi,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            const errorMessage = error.message || 'Internal server error';

            throw new HttpException(
                {
                    message: errorMessage,
                    status: statusCode,
                    details: error.details || 'An unexpected error occurred.',
                },
                statusCode,
            );
        }
    }

    @ApiBearerAuth()
    @Post('remove-logs')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'raw_data', maxCount: 1 },]))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload and merge files',
        description: 'This endpoint accepts two files: "Payment Log Data" and "Raw API Log Data". The files are validated, processed, merged, and the result will be upload in the database.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                raw_data: {
                    type: 'string',
                    format: 'binary',
                    description: 'Raw API Log Data file',
                },
            },
            required: ['raw_data',],
        },
    })
    async filter(@UploadedFiles() files: { raw_data?: Express.Multer.File[]; }, @Req() req: any) {
        try {
            if (!files?.raw_data) {
                throw new HttpException('The "raw_data" file is required', HttpStatus.BAD_REQUEST);
            }

            const raw_dataPath = files.raw_data[0].path;


            const removeResult = await this.uploadService.filterFiles(raw_dataPath,);

            return {
                message: 'Logs removed successfully',
                result: removeResult,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error; // Re-throw expected errors with proper status codes
            }

            const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            const errorMessage = error.message || 'Internal server error';

            throw new HttpException(
                {
                    message: errorMessage,
                    status: statusCode,
                    details: error.details || 'An unexpected error occurred.',
                },
                statusCode,
            );
        }
    }

}
