import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { InvoiceService } from './invoice.service';

@Processor('invoice')
export class InvoiceProcessor {
    constructor(private readonly invoiceService: InvoiceService) { }

    @Process('generate-invoice')
    async handleInvoice(job: Job) {
        console.log("GENERATE-INVOICE")
        const invoice = await this.invoiceService.invoiceCreationMonthlyTpp(job.data.tpp);
        // await job.queue.add('generate-pdf', { invoice });
    }

    @Process('generate-pdf')
    async handlePdf(job: Job) {
        const pdf = await this.invoiceService.generatePdf(job.data.invoice);
        await job.queue.add('send-email', { invoice: job.data.invoice, pdf });
    }

    @Process('send-email')
    async handleEmail(job: Job) {
        await this.invoiceService.sendEmail(job.data.invoice, job.data.pdf);
    }

    @Process('generate-invoice-daily')
    async dailyCron(job: Job) {
        console.log('Processing job');
        try {
            console.log('Processing job for TPP:', job.data.tpp);
            await this.invoiceService.invoiceCreationSingleDay(job.data.tpp);
        } catch (err) {
            console.error('Job failed:', err);
            throw err;
        }
    }
}
