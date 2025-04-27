import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type uploadLogDocument = uploadLog & Document;

@Schema({ timestamps: true, collection: 'upload_log' })
export class uploadLog {
    @Prop({ required: true })
    batchNo: string;

    @Prop({ required: true })
    uploadedAt: Date;

    @Prop({ required: true })
    raw_log_path: string;

    @Prop({ required: true })
    payment_log_path: string;

    @Prop({ required: true })
    status: string;

    @Prop({ required: true })
    uploadedBy: string;

    @Prop({ default: null }) // Optional
    remarks?: string;

    @Prop({ type: [String], default: [] }) // Log field as an array of strings
    log: string[];

}

export const uploadLogSchema = SchemaFactory.createForClass(uploadLog);