import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PageMultiplierDocument = PageMultiplier & Document;

@Schema({ timestamps: true })
export class Transaction {
    @Prop({ required: true, unique: true })
    paymentId: string;

    @Prop({ required: true })
    lfi_id: string;

    @Prop({ required: true })
    tpp_id: string;

    @Prop({ required: true })
    appliedLimit: number;

    @Prop({ required: true })
    chargeableAmount: number;

    @Prop({ required: true })
    charge: number;

    @Prop({ required: true })
    mdp_rate: number;

    @Prop({ required: true })
    isAttended: boolean;
}

@Schema()
export class Summary {
    @Prop({ required: true })
    psuId: string;

    @Prop({ required: true })
    date: string;

    @Prop({ required: true })
    totalPages: number;

    @Prop({ required: true })
    chargeableTransactions: number;

    @Prop({ required: true })
    charge: number;
}

@Schema({ timestamps: true, collection: 'page_multiplier' })
export class PageMultiplier {
    @Prop({ type: [Transaction], required: true })
    transactions: Transaction[];

    @Prop({ type: Summary, required: true })
    summary: Summary;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
export const SummarySchema = SchemaFactory.createForClass(Summary);
export const PageMultiplierSchema = SchemaFactory.createForClass(PageMultiplier);
