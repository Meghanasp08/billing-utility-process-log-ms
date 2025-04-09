import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Log, LogSchema } from './schemas/billing-log.schema';
import { LfiData, LfiDataSchema } from './schemas/lfi-data.schema';
import { TppData, TppDataSchema } from './schemas/tpp-data.schema';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }, { name: LfiData.name, schema: LfiDataSchema }, { name: TppData.name, schema: TppDataSchema }]),
  MulterModule.register({
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      },
    }),
  }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule { }
