import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GlobalConfigurationDocument = GlobalConfiguration & Document;

@Schema({ timestamps: true, collection: 'global_configuration' })
export class GlobalConfiguration {
    @Prop({ required: true })
    item: string;

    @Prop({ required: true })
    group: string;

    @Prop({ required: true })
    type: string;

    @Prop({ required: false })
    amount?: string; // Example: "50 AED", "250 fils"

    @Prop({ required: false })
    count?: number; // Example: "15", "5" for free limits
}

export const GlobalConfigurationSchema = SchemaFactory.createForClass(GlobalConfiguration);