import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UploadService } from './upload/upload.service';
import { uploadLog, uploadLogDocument } from './upload/schemas/upload-log.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class AppService {
  constructor(
    private readonly uploadService: UploadService,
    @InjectModel(uploadLog.name) private uploadLog: Model<uploadLogDocument>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async processUploadedFiles(data: any) {
    console.log('🔄 Starting file processing...');
    console.log('📦 Received data:', JSON.stringify(data, null, 2));
    const { userEmail, file1Path, file2Path, jobId } = data;

    try {
      // Download files from API to local uploads folder
      console.log('⬇️ Downloading files...');
      const localFile1Path = await this.downloadFile(file1Path, jobId, 'raw_data');
      const localFile2Path = file2Path ? await this.downloadFile(file2Path, jobId, 'payment_data') : '';

      console.log('📥 Files downloaded locally');
      console.log('  Raw data:', localFile1Path);
      console.log('  Payment data:', localFile2Path || 'N/A');

      // Process the files using the existing upload service
      console.log('🚀 Starting CSV processing...');
      await this.uploadService.mergeCsvFilesRefactor(
        userEmail,
        localFile1Path,
        localFile2Path,
        jobId,
        false
      );

      console.log('✅ File processing completed successfully');
    } catch (error) {
      console.error('❌ Error in processUploadedFiles:', error);
      console.error('Stack:', error.stack);
      
      // Update database status to Failed
      try {
        await this.uploadLog.findOneAndUpdate(
          { batchNo: jobId },
          {
            $set: {
              status: 'Failed',
              completedAt: new Date(),
              remarks: `Processing failed: ${error.message}`,
              isProcessed: true
            },
            $push: {
              log: {
                description: `Error: ${error.message}`,
                status: 'Failed',
                errorDetail: error.stack || error.message
              }
            }
          }
        );
        console.log('📝 Database updated with failure status');
      } catch (dbError) {
        console.error('❌ Failed to update database:', dbError);
      }
      
      throw error;
    }
  }

  private async downloadFile(url: string, jobId: string, fileType: string): Promise<string> {
    if (!url) return '';

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Extract filename from URL or create a unique one
    const urlParts = url.split('/');
    const originalFilename = urlParts[urlParts.length - 1];
    const localFilePath = path.join(uploadsDir, originalFilename);

    return new Promise((resolve, reject) => {
      console.log(`⬇️ Downloading ${fileType} from ${url}`);
      
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(localFilePath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`✅ Downloaded ${fileType} to ${localFilePath}`);
          resolve(localFilePath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(localFilePath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }
}
