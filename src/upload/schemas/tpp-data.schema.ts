
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TppDataDocument = TppData & Document;

@Schema({ timestamps: true, collection: 'tpp_data' })
export class TppData {
    @Prop({ required: true, unique: true })
    tpp_id: string;

    @Prop({ required: true })
    tpp_name: string;

    @Prop({ required: false })
    registered_name: string;

    @Prop({ required: false })
    addressLine_2: string;

    @Prop({ required: false })
    size: string;

    @Prop({ required: false })
    country: string;

    @Prop({ required: false })
    post_code: string;

    @Prop({ required: false })
    org_status: string;

    @Prop({ required: false })
    contact_type: string;

    @Prop({ required: false, type: [String] }) // Store emails as an array
    email_address: string[];

    @Prop({ required: false })
    first_name: string;

    @Prop({ required: false })
    last_name: string;

    @Prop({ required: false })
    user_status: string;
}

export const TppDataSchema = SchemaFactory.createForClass(TppData);
