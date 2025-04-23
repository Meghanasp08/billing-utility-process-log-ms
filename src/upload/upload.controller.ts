import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Post,
    UploadedFiles,
    UseInterceptors
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

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
