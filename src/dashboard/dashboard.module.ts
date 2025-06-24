import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { InvoiceSchema } from 'src/invoice/schemas/invoice.schema';
import { LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';
import { TppDataSchema } from 'src/upload/schemas/tpp-data.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { LogSchema } from 'src/upload/schemas/billing-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Invoices', schema: InvoiceSchema },
      { name: 'TppData', schema: TppDataSchema },
      { name: 'LfiData', schema: LfiDataSchema },
      { name: 'Logs', schema: LogSchema },
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule { }
