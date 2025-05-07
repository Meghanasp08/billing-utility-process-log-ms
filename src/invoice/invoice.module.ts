import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { InvoiceSchema } from './schemas/invoice.schema';
import { LogSchema } from 'src/upload/schemas/billing-log.schema';
import { TppDataSchema } from 'src/upload/schemas/tpp-data.schema';
import { LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';
import { CollectionMemoSchema } from './schemas/collection-memo.schems';
import { SingleDayTppInvoiceSchema } from './schemas/single-day-invoice-tpp.schems';
import { SingleDayCollectionMemoSchema } from './schemas/single_day_collection-memo.schems';
import { GlobalConfiguration, GlobalConfigurationSchema } from 'src/configuration/schema/global_config.schema';
import { CounterSchema } from './schemas/counter.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Invoices', schema: InvoiceSchema },
      { name: 'Logs', schema: LogSchema },
      { name: 'TppData', schema: TppDataSchema },
      { name: 'LfiData', schema: LfiDataSchema },
      { name: 'CollectionMemo', schema: CollectionMemoSchema },
      { name: 'SingleDayTppInvoice', schema: SingleDayTppInvoiceSchema },
      { name: 'SingleDayCollectionMemo', schema: SingleDayCollectionMemoSchema },
      { name: GlobalConfiguration.name, schema: GlobalConfigurationSchema },
      { name: 'Counter', schema: CounterSchema },

    ]),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
})
export class InvoiceModule { }
