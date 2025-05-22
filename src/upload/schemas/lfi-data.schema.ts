
// import { Document, model, Schema } from 'mongoose';

// export interface ILfiData extends Document {
//     lfi_id: string;
//     mdp_retail_sme: number;
//     mdp_corporate: number;
// }

// const LfiDataSchema = new Schema<ILfiData>({
//     lfi_id: { type: String, required: true, unique: true },
//     mdp_retail_sme: { type: Number, required: true },
//     mdp_corporate: { type: Number, required: true },
// });

// export const LfiDataModel = model<ILfiData>('LfiData', LfiDataSchema);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LfiDataDocument = LfiData & Document;

@Schema({ timestamps: true, collection: 'lfi_data' })
export class LfiData {
    @Prop({ required: true, unique: true })
    lfi_id: string;

    @Prop({ required: true })
    lfi_name: string;

    @Prop({ required: true })
    mdp_rate: number;

    @Prop({ required: true })
    free_limit_attended: number;

    @Prop({ required: true })
    free_limit_unattended: number;

    @Prop({ required: false })
    email: string;

}

export const LfiDataSchema = SchemaFactory.createForClass(LfiData);
