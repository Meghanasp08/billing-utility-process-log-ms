import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { InvoiceSchema } from './schemas/invoice.schema';
import { LogSchema } from 'src/upload/schemas/billing-log.schema';
import { TppDataSchema } from 'src/upload/schemas/tpp-data.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Invoices', schema: InvoiceSchema },
      { name: 'Logs', schema: LogSchema },
      { name: 'TppData', schema: TppDataSchema }
    ]),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
})
export class InvoiceModule { }
