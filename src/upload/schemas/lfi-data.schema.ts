
import { Document, model, Schema } from 'mongoose';

export interface ILfiData extends Document {
    lfi_id: string;
    mdp_retail_sme: number;
    mdp_corporate: number;
}

const LfiDataSchema = new Schema<ILfiData>({
    lfi_id: { type: String, required: true, unique: true },
    mdp_retail_sme: { type: Number, required: true },
    mdp_corporate: { type: Number, required: true },
});

export const LfiDataModel = model<ILfiData>('LfiData', LfiDataSchema);