import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Post,
    Req,
    Res,
    UploadedFiles,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { UploadService } from './upload.service';



@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post()
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
            required: ['raw_data', 'payment_data'],
        },
    })
    async uploadFiles(@UploadedFiles() files: { raw_data?: Express.Multer.File[]; payment_data?: Express.Multer.File[]; }, @Req() req: any) {
        try {
            console.log('Uploaded files:', req.user.email);
            if (!files?.raw_data || !files?.payment_data) {
                throw new HttpException('Both files are required', HttpStatus.BAD_REQUEST);
            }

            const [raw_dataPath, payment_dataPath] = [
                files.raw_data[0].path,
                files.payment_data[0].path,
                // files.file3[0].path,
            ];

            const mergedFilePath = await this.uploadService.mergeCsvFiles(req.user.email, raw_dataPath, payment_dataPath,);

            return {
                message: 'Files merged and uploaded successfully',
                result: mergedFilePath,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;

        }
    }

    // @UseGuards(JwtAuthGuard)
    @Post('csv')
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

            const mergedFilePath = await this.uploadService.mergeCsvFiles(req.user.email, raw_dataPath, payment_dataPath, downloadCsv);

            // return {
            //     message: 'Merged CCV File generated Successfully',
            //     result: mergedFilePath,
            //     statusCode: HttpStatus.OK
            // }
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
    @Get('log')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get upload log data' })
    async getUploadLog(@Req() req: any) {
        try {
            const uploadLog = await this.uploadService.getUploadLogData();
            return {
                message: 'Upload Log details',
                result: uploadLog,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;
        }
    }

}
