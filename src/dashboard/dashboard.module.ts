import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { InvoiceSchema } from 'src/invoice/schemas/invoice.schema';
import { TppDataSchema } from 'src/upload/schemas/tpp-data.schema';
import { LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Invoices', schema: InvoiceSchema },
      { name: 'TppData', schema: TppDataSchema },
      { name: 'LfiData', schema: LfiDataSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule { }
