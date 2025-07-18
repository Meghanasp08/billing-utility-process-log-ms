import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApiDataConfigurationDocument = ApiDataConfiguration & Document;

@Schema({ timestamps: true, collection: 'api_data' })
export class ApiDataConfiguration {
    @Prop({ required: true })
    url: string;

    // @Prop({ required: true })
    // api_endpoint: string;

    @Prop({ required: true })
    api_operation: string;

    @Prop({ type: Boolean, default: false })
    chargeable_api_hub_fee: boolean;

    @Prop({ type: Boolean, default: false })
    chargeable_LFI_TPP_fee: boolean;

    @Prop({ required: true })
    key_name: string;

    @Prop({ required: true })
    api_category: string;

    @Prop({ type: Boolean, default: false })
    quote_status: boolean;
}

export const ApiDataConfigurationSchema = SchemaFactory.createForClass(ApiDataConfiguration);