import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Log } from './billing-log.schema';

@Schema({ collection: 'temp_logs' })
export class TempRawLog extends Log {
    @Prop({ required: true })
    jobId: string;
}

export const TempRawLogSchema = SchemaFactory.createForClass(TempRawLog);