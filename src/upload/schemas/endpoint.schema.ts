import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApiDataDocument = ApiData & Document;

@Schema({ timestamps: true })
export class ApiData {

    @Prop({ required: true })
    api_spec: string;

    @Prop({ required: true })
    api_endpoint: string;

    @Prop({ required: true })
    api_operation: string;

    @Prop({ required: true })
    chargeable_api_hub_fee: boolean;

    @Prop({ required: true })
    chargeable_LFI_TPP_fee: boolean;
}

export const ApiDataSchema = SchemaFactory.createForClass(ApiData);
