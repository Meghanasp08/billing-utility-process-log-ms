import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { InvoiceSchema } from './schemas/invoice.schema';
import { LogSchema } from 'src/upload/schemas/billing-log.schema';
import { TppDataSchema } from 'src/upload/schemas/tpp-data.schema';
import { LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';
import { CollectionMemoSchema } from './schemas/collection-memo.schems';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Invoices', schema: InvoiceSchema },
      { name: 'Logs', schema: LogSchema },
      { name: 'TppData', schema: TppDataSchema },
      {name:'LfiData', schema: LfiDataSchema},
      {name:'CollectionMemo', schema: CollectionMemoSchema},
    ]),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
})
export class InvoiceModule { }
