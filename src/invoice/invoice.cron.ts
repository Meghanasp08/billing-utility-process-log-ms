import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Queue } from "bull";
import { Model } from "mongoose";
import { CronJob } from 'cron'
import { Cron } from '@nestjs/schedule'

@Injectable()
export class InvoiceCron {
    constructor(
        @InjectQueue('invoice') private invoiceQueue: Queue,
        @InjectModel('TppData') private readonly tppDataModel: Model<any>,
    ) { }

    // @Cron('0 0 1 * *') // Every month start
    // async handleCron() {
    //     const allTPPs = await this.tppDataModel.find();
    //     for (const tpp of allTPPs) {
    //         await this.invoiceQueue.add('generate-invoice', { tpp });
    //     }
    // }

    // @Cron('*/1 * * * *') // Every month start
    // @Cron('*/3 * * * * *') // Every 5 seconds
    async handleDailyCron() {
        const allTPPs = await this.tppDataModel.find();
        console.log("CRONE RUNNING");
        // for (const tpp of allTPPs) {
        //     await this.invoiceQueue.add('daily-crone', { tpp });
        // }
    }

}


