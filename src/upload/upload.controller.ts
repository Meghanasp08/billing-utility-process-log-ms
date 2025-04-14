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
        { name: 'file1', maxCount: 1 },
        { name: 'file2', maxCount: 1 },]))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload and merge files',
        description: 'This endpoint accepts two files: "Payment Log Data" and "Raw API Log Data". The files are validated, processed, merged, and the result will be upload in the database.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file1: {
                    type: 'string',
                    format: 'binary',
                    description: 'Raw API Log Data file',
                },
                file2: {
                    type: 'string',
                    format: 'binary',
                    description: 'Payment Log Data file',
                },
            },
            required: ['file1', 'file2'],
        },
    })
    async uploadFiles(@UploadedFiles() files: { file1?: Express.Multer.File[]; file2?: Express.Multer.File[]; }) {
        try {
            console.log('Uploaded files:', files);
            if (!files?.file1 || !files?.file2) {
                throw new HttpException('Both files are required', HttpStatus.BAD_REQUEST);
            }

            const [file1Path, file2Path] = [
                files.file1[0].path,
                files.file2[0].path,
                // files.file3[0].path,
            ];

            const mergedFilePath = await this.uploadService.mergeCsvFiles(file1Path, file2Path);

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
