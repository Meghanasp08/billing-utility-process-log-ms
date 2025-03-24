import {
    Controller,
    HttpException,
    HttpStatus,
    Post,
    UploadedFiles,
    UseInterceptors
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Post()
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'file1', maxCount: 1 },
        { name: 'file2', maxCount: 1 },]))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file1: {
                    type: 'string',
                    format: 'binary',
                },
                file2: {
                    type: 'string',
                    format: 'binary',
                },
            },
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

}
