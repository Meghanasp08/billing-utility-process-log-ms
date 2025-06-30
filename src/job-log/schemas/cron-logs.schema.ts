import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class StepLog {
  @Prop() step: string;
  @Prop() status: 'SUCCESS' | 'FAILED';
  @Prop() message: string;
  @Prop() timestamp: Date;
  @Prop() error?: string;
}

class TppLog {
  @Prop() tppId: string;
  @Prop() email: [string];
  @Prop({ type: [StepLog] }) steps: StepLog[];
  @Prop() isCompleted: boolean;
}

class LfiLog {
  @Prop() lfiId: string;
  @Prop() email: string;
  @Prop({ type: [StepLog] }) steps: StepLog[];
  @Prop() isCompleted: boolean;
}

@Schema({ timestamps: true })
export class CronLog extends Document {
  @Prop() cronName: string;

  @Prop() cronTime: Date;

  @Prop({ enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'], default: 'IN_PROGRESS' })
  status: string;

  @Prop({ type: [TppLog] }) tppLogs: TppLog[];
}

export const CronLogSchema = SchemaFactory.createForClass(CronLog);
