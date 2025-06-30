import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { InvoiceService } from './invoice.service';
import { JobLogService } from 'src/job-log/job-log.service';

@Processor('invoice')
export class InvoiceProcessor {
    constructor(
        private readonly invoiceService: InvoiceService,
        private readonly jobLogService: JobLogService,
    ) { }

    @Process('generate-invoice-tpp')
    async handleInvoiceForTpp(job: Job) {
        const tppId  = job.data.tpp.tpp_id;
        try {
            console.log("GENERATE-INVOICE FOR",tppId)
            const invoice = await this.invoiceService.invoiceCreationMonthlyTpp(job.data.tpp);
            console.log("INVOICE", invoice)
            await job.queue.add('generate-pdf', { invoice, key: 'tpp' });
        } catch (err) {
            await this.jobLogService.log(tppId, 'INVOICE_GENERATION', 'FAILED', err.message, { stack: err.stack });
        }
    }

    @Process('generate-invoice-lfi')
    async handleInvoiceForLfi(job: Job) {
        console.log("GENERATE-INVOICE")
        const invoice = await this.invoiceService.invoiceCreationMonthlyLfi(job.data.lfi);
        console.log("INVOICE", invoice)
        await job.queue.add('generate-pdf', { invoice, key: 'lfi' });
    }

    @Process('generate-pdf')
    async handlePdf(job: Job) {
        console.log("ENTERING TO PDF")
        const pdf = await this.invoiceService.generatePdf(job.data.invoice, job.data.key);
        // await job.queue.add('send-email', { invoice: job.data.invoice, pdf });
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
