
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TppDataDocument = TppData & Document;

@Schema({ timestamps: true })
export class TppData {
    @Prop({ required: true, unique: true })
    tpp_id: string;

    @Prop({ required: true })
    tpp_name: string;

    @Prop({ required: true })
    tpp_client_id: string;

}

export const TppDataSchema = SchemaFactory.createForClass(TppData);
