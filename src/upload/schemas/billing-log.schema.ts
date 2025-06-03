import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

@Schema({ timestamps: true })
export class RawApiLogData {
  @Prop()
  timestamp: Date;

  @Prop()
  lfi_name: string;

  @Prop()
  lfi_id: string;

  @Prop()
  tpp_name: string;

  @Prop()
  tpp_id: string;

  @Prop()
  tpp_client_id: string;

  @Prop()
  api_set_sub: string;

  @Prop()
  http_method: string;

  @Prop()
  url: string;

  @Prop()
  tpp_response_code_group: string;

  @Prop()
  execution_time: number;

  @Prop()
  interaction_id: string;

  @Prop()
  resource_name: string;

  @Prop()
  lfi_response_code_group: string;

  @Prop()
  is_attended: boolean;

  @Prop()
  records: number;

  @Prop()
  payment_type: string;

  @Prop()
  payment_id: string;

  @Prop()
  paymentid: string;

  @Prop()
  merchant_id: string;

  @Prop()
  psu_id: string;

  @Prop()
  is_large_corporate: boolean;

  @Prop()
  user_type: string;

  @Prop()
  purpose: string;
}

export const RawApiLogDataSchema = SchemaFactory.createForClass(RawApiLogData);

@Schema({ timestamps: true })
export class PaymentLogs {
  @Prop()
  timestamp: Date;

  @Prop()
  lfi_name: string;

  @Prop()
  lfi_id: string;

  @Prop()
  tpp_name: string;

  @Prop()
  tpp_id: string;

  @Prop()
  tpp_client_id: string;

  @Prop()
  status: string;

  @Prop()
  currency: string;

  @Prop()
  amount: number;

  @Prop()
  payment_consent_type: string;

  @Prop()
  transaction_id: string;

  @Prop()
  payment_type: string;

  @Prop()
  payment_id: string;

  @Prop()
  merchant_id: string;

  @Prop()
  psu_id: string;

  @Prop()
  is_large_corporate: boolean;

  @Prop()
  number_of_successful_transactions: number;

  @Prop()
  international_payment: boolean;
}

export const PaymentLogsSchema = SchemaFactory.createForClass(PaymentLogs);


export class Transaction {
  @Prop()
  timestamp: Date;

  @Prop()
  paymentId: string;

  @Prop()
  amount: number;

  @Prop()
  appliedLimit: number;

  @Prop()
  chargeableAmount: number;
}

@Schema({ timestamps: true })
export class MerchantDailyData {
  @Prop()
  merchantId: string;

  @Prop()
  date: string;

  @Prop({ type: [Transaction] })
  transactions: Transaction[];

  @Prop()
  totalAmount: number;

  @Prop()
  limitApplied: boolean;

  @Prop()
  remainingBalance: number;
}


@Schema({ timestamps: true })
export class Log {
  @Prop({ type: RawApiLogDataSchema })
  raw_api_log_data: RawApiLogData;

  @Prop({ type: PaymentLogsSchema })
  payment_logs: PaymentLogs;

  @Prop()
  chargeable: boolean;

  @Prop()
  lfiChargable: boolean;

  @Prop()
  success: boolean;

  @Prop()
  discounted: boolean;

  @Prop()
  discountType: string;

  @Prop()
  group: string;

  @Prop()
  type: string;

  @Prop()
  api_hub_fee: number;

  @Prop()
  apiHubVolume: number;

  @Prop()
  applicableApiHubFee: number;

  @Prop()
  api_category: string;

  @Prop({ type: Number, default: 0, validate: { validator: (val: number) => !isNaN(val), message: 'Value must be a number' } })
  calculatedFee: number;

  @Prop({ type: Number, default: 0, validate: { validator: (val: number) => !isNaN(val), message: 'Value must be a number' } })
  applicableFee: number;

  @Prop({ type: Number, default: 0, validate: { validator: (val: number) => !isNaN(val), message: 'Value must be a number' } })
  numberOfPages: number;

  @Prop({ type: Number, default: 0, validate: { validator: (val: number) => !isNaN(val), message: 'Value must be a number' } })
  unit_price: number;

  @Prop({ type: Number, default: 0, validate: { validator: (val: number) => !isNaN(val), message: 'Value must be a number' } })
  volume: number;

  @Prop({ type: Number, default: 0, validate: { validator: (val: number) => !isNaN(val), message: 'Value must be a number' } })
  appliedLimit: number;

  @Prop()
  limitApplied: boolean;

  @Prop()
  isCapped: boolean;

  @Prop()
  duplicate: boolean;

  @Prop({ type: Number, default: 0, validate: { validator: (val: number) => !isNaN(val), message: 'Value must be a number' } })
  cappedAt: number;

  @Prop()
  createdAt: Date; // Explicitly define the createdAt field

  @Prop()
  updatedAt: Date;
  // @Prop({ type: [MerchantDailyData] })
  // result: MerchantDailyData[];
}

export const LogSchema = SchemaFactory.createForClass(Log);
