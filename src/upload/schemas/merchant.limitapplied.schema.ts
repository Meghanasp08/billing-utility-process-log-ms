import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MerchantTransactionDocument = MerchantTransaction & Document;

@Schema({ timestamps: true })
export class Transaction {
    @Prop({ required: true })
    timestamp: Date;

    @Prop({ required: true })
    paymentId: string;

    @Prop({ required: true })
    amount: number;

    @Prop({ required: false, default: 0 })
    appliedLimit: number;

    @Prop({ required: false, default: 0 })
    chargeableAmount: number;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

@Schema({ timestamps: true, collection: 'merchant_transactions' })
export class MerchantTransaction {
    @Prop({ required: true })
    merchantId: string;

    @Prop({ required: true })
    date: Date;

    @Prop({ type: [TransactionSchema], required: true })
    transactions: Transaction[];

    @Prop({ required: true })
    totalAmount: number;

    @Prop({ required: true })
    limitApplied: boolean;

    @Prop({ required: false, default: 0 })
    remainingBalance: number;
}

export const MerchantTransactionSchema = SchemaFactory.createForClass(MerchantTransaction);
