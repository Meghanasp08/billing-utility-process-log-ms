// job-log.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class JobLog extends Document {
  @Prop() tppId: string;

  @Prop() step: string; // e.g. INVOICE_GENERATION, PDF_GENERATION

  @Prop({ enum: ['SUCCESS', 'FAILED'] })
  status: 'SUCCESS' | 'FAILED';

  @Prop() message: string;

  @Prop({ type: Object }) // ✅ EXPLICITLY SET TYPE
  meta?: Record<string, any>;
}

export const JobLogSchema = SchemaFactory.createForClass(JobLog);
