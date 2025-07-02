
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TppDataDocument = TppData & Document;

@Schema({ timestamps: true, collection: 'tpp_data' })
export class TppData {
    @Prop({ required: true, unique: true })
    tpp_id: string;

    @Prop({ required: true })
    tpp_name: string;

    @Prop({ required: true })
    brokerage_fee: number;

    @Prop({ required: false })
    registered_name: string;

    @Prop({ required: false })
    addressLine_2: string;

    @Prop({ required: false })
    country: string;

    @Prop({ required: false })
    post_code: string;

    @Prop({ required: false })
    org_status: string;

    @Prop({ required: false })
    contact_type: string;

    @Prop({ required: true, default: false })
    serviceStatus: boolean;

    // @Prop({
    //     type: [
    //         {
    //             email: { type: String, required: true },
    //             status: { type: String, required: true },
    //         },
    //     ],
    //     required: false,
    //     default: [],
    // })

    @Prop({ required: false, type: [String] }) // Store emails as an array
    email_address: string[];

    contact: { email: string; status: string }[];

    @Prop({ required: false })
    first_name: string;

    @Prop({ required: false })
    last_name: string;


}

export const TppDataSchema = SchemaFactory.createForClass(TppData);
