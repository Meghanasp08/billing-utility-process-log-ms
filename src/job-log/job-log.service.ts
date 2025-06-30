// job-log.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobLog } from './schemas/job-log.schema';
import { CronLog } from './schemas/cron-logs.schema';


@Injectable()
export class JobLogService {
  constructor(
    @InjectModel(JobLog.name)
    private readonly jobLogModel: Model<JobLog>,
    @InjectModel(CronLog.name)
    private readonly cronLogModel: Model<CronLog>,
  ) { }

  async log(
    tppId: string,
    step: string,
    status: 'SUCCESS' | 'FAILED',
    message: string,
    meta?: any
  ) {
    return this.jobLogModel.create({ tppId, step, status, message, meta });
  }

  async startCron(cronName: string, tpps: { tppId: string; email: string }[]) {
    const cronTime = new Date();
    return this.cronLogModel.create({
      cronName,
      cronTime,
      tppLogs: tpps.map(t => ({
        tppId: t.tppId,
        email: t.email,
        steps: [],
        isCompleted: false,
      })),
    });
  }

  async logStep(cronLogId: string, tppId: string, step: string, status: 'SUCCESS' | 'FAILED', message: string, error?: string) {
    return this.cronLogModel.updateOne(
      { _id: cronLogId, 'tppLogs.tppId': tppId },
      {
        $push: {
          'tppLogs.$.steps': {
            step,
            status,
            message,
            error,
            timestamp: new Date(),
          },
        },
        $set: {
          'tppLogs.$.isCompleted': step === 'EMAIL_SENDING' && status === 'SUCCESS',
        },
      }
    );
  }

  async completeCron(cronLogId: string) {
    return this.cronLogModel.findByIdAndUpdate(cronLogId, { status: 'COMPLETED' });
  }

  async failCron(cronLogId: string) {
    return this.cronLogModel.findByIdAndUpdate(cronLogId, { status: 'FAILED' });
  }

  async getCronLogById(cronLogId: string) {
    return this.cronLogModel.findById(cronLogId);
  }

}
