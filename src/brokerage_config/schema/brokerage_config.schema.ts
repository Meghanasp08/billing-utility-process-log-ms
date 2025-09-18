import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false }) // prevents creating a separate _id for this subdocument
export class ConfigurationFee {

    @Prop({ type: Number, required: true })
    motor: number;

    @Prop({ type: Number, required: true })
    renter: number;

    @Prop({ type: Number, required: true })
    travel: number;

    @Prop({ type: Number, required: true })
    home: number;

    @Prop({ type: Number, required: true })
    health: number;

    @Prop({ type: Number, required: true })
    life: number;

    @Prop({ type: Number, required: true })
    employment_ILO: number;
}

export type BrokerageConfigurationDocument = BrokerageConfiguration & Document;

@Schema({ timestamps: true, collection: 'brokerage_configuration' })
export class BrokerageConfiguration {
    @Prop({ required: true })
    tpp_id: string;

    @Prop({ required: true })
    lfi_id: string;

    @Prop({ required: true, default: 'insurance' })
    type: string;

    @Prop({ type: ConfigurationFee, required: true })
    configuration_fee: ConfigurationFee;

    @Prop({ type: Boolean, default: false })
    serviceStatus: boolean;
}

export const BrokerageConfigurationSchema = SchemaFactory.createForClass(BrokerageConfiguration);
