import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AuthModule } from 'src/auth/auth.module';
import { Log, LogSchema } from './schemas/billing-log.schema';
import { ApiData, ApiDataSchema } from './schemas/endpoint.schema';
import { LfiData, LfiDataSchema } from './schemas/lfi-data.schema';
import { MerchantTransaction, MerchantTransactionSchema } from './schemas/merchant.limitapplied.schema';
import { PageMultiplier, PageMultiplierSchema } from './schemas/pagemultiplier.schema';
import { TppData, TppDataSchema } from './schemas/tpp-data.schema';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }, { name: LfiData.name, schema: LfiDataSchema }, { name: TppData.name, schema: TppDataSchema }, { name: ApiData.name, schema: ApiDataSchema }, { name: MerchantTransaction.name, schema: MerchantTransactionSchema }, { name: PageMultiplier.name, schema: PageMultiplierSchema }]),
  MulterModule.register({
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      },
    }),
  }),
    AuthModule,
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule { }
