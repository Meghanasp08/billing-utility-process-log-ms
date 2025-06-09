import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type uploadLogDocument = uploadLog & Document;



export class LogEntry {
    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    status: string;

    @Prop({ default: null }) // Optional field
    errorDetail?: string;
}

@Schema({ timestamps: true, collection: 'upload_log' })
export class uploadLog {
    @Prop({ required: true })
    batchNo: string;

    @Prop({ required: true })
    uploadedAt: Date;

    @Prop({ required: false })
    raw_log_path: string;

    @Prop({ required: false })
    payment_log_path: string;

    @Prop({ required: false })
    master_log_path: string;

    @Prop({ required: true })
    key: string;

    @Prop({ required: false })
    fileName: string;

    @Prop({ required: true })
    status: string;

    @Prop({ required: true })
    uploadedBy: string;

    @Prop({ default: null }) // Optional
    remarks?: string;

    @Prop({ type: [LogEntry], default: [] }) // Log field as an array of objects
    log: LogEntry[];

}



export const uploadLogSchema = SchemaFactory.createForClass(uploadLog);