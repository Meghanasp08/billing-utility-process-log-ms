import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GlobalConfigurationDocument = GlobalConfiguration & Document;

@Schema({ timestamps: true, collection: 'global_configuration' })
export class GlobalConfiguration {
    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    key: string;

    @Prop({ required: true })
    value: number;

    @Prop({ required: false })
    type: string; // Example: "50 AED", "250 fils"

}

export const GlobalConfigurationSchema = SchemaFactory.createForClass(GlobalConfiguration);