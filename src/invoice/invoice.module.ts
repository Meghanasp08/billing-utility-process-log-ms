import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { GlobalConfiguration, GlobalConfigurationSchema } from 'src/configuration/schema/global_config.schema';
import { MailModule } from 'src/mail/mail.module';
import { LogSchema } from 'src/upload/schemas/billing-log.schema';
import { LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';
import { TppDataSchema } from 'src/upload/schemas/tpp-data.schema';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { CollectionMemoSchema } from './schemas/collection-memo.schems';
import { CounterSchema } from './schemas/counter.schema';
import { InvoiceSchema } from './schemas/invoice.schema';
import { SingleDayTppInvoiceSchema } from './schemas/single-day-invoice-tpp.schems';
import { SingleDayCollectionMemoSchema } from './schemas/single_day_collection-memo.schems';
import { BullModule } from '@nestjs/bull';
import { InvoiceProcessor } from './invoice.processor';

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
    MailModule,
    AuthModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'invoice',
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService,InvoiceProcessor],
})
export class InvoiceModule { }
