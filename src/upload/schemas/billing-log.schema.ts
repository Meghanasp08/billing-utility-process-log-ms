import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

@Schema({ timestamps: true })
export class RawApiLogData {
  @Prop()
  timestamp: Date;

  @Prop()
  lfi_id: string;

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
  is_attended: string;

  @Prop()
  records: number;

  @Prop()
  payment_type: string;

  @Prop()
  paymentid: string;

  @Prop()
  merchant_id: string;

  @Prop()
  psu_id: string;

  @Prop()
  is_large_corporate: string;

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
  lfi_id: string;

  @Prop()
  tpp_id: string;

  @Prop()
  tpp_client_id: string;

  @Prop()
  currency: string;

  @Prop()
  amount: number;

  @Prop()
  payment_consent_type: string;

  @Prop()
  transaction_id: string;

  @Prop()
  payment_id: string;

  @Prop()
  merchant_id: string;

  @Prop()
  psu_id: string;

  @Prop()
  is_large_corporate: string;

  @Prop()
  number_of_successful_transactions: number;

  @Prop()
  international_payment: string;
}

export const PaymentLogsSchema = SchemaFactory.createForClass(PaymentLogs);

@Schema({ timestamps: true })
export class Log {
  @Prop({ type: RawApiLogDataSchema })
  raw_api_log_data: RawApiLogData;

  @Prop({ type: PaymentLogsSchema })
  payment_logs: PaymentLogs;

  @Prop()
  chargeable: boolean;

  @Prop()
  group: string;

  @Prop()
  type: string;
}

export const LogSchema = SchemaFactory.createForClass(Log);
