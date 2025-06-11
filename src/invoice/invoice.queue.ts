import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceProcessor } from './invoice.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'invoice',
    }),
  ],
  providers: [InvoiceProcessor, InvoiceService],
})
export class InvoiceQueueModule {}
