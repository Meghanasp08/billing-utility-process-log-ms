// job-log.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobLog, JobLogSchema } from './schemas/job-log.schema';
import { JobLogService } from './job-log.service';
import { CronLog, CronLogSchema } from './schemas/cron-logs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: JobLog.name, schema: JobLogSchema }]),
    MongooseModule.forFeature([{ name: CronLog.name, schema: CronLogSchema }]),
  ],
  providers: [JobLogService],
  exports: [JobLogService],
})
export class JobLogModule {}
