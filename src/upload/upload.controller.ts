import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Post,
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
    async uploadFiles(@UploadedFiles() files: { raw_data?: Express.Multer.File[]; payment_data?: Express.Multer.File[]; }) {
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

            const mergedFilePath = await this.uploadService.mergeCsvFiles(raw_dataPath, payment_dataPath);

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
    async uploadFilesForCsv(@UploadedFiles() files: { raw_data?: Express.Multer.File[]; payment_data?: Express.Multer.File[]; }, @Res() res: Response) {
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

            const mergedFilePath = await this.uploadService.mergeCsvFiles(raw_dataPath, payment_dataPath, downloadCsv);

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
    @Get('api')
    async getLfiDetails() {
        try {
            const logData = await this.uploadService.getapis();
            return {
                message: 'Lfi Details',
                result: logData,
                statusCode: HttpStatus.OK
            }
        } catch (error) {
            throw error;
        }
    }

}
