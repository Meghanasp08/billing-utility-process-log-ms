import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { TppData, TppDataDocument } from 'src/upload/schemas/tpp-data.schema';
import { BrokerageConfiguration, BrokerageConfigurationDocument } from 'src/brokerage_config/schema/brokerage_config.schema';
import { CreateGlobalConfigurationDto } from './dto/brokerage_config.dto';

@Injectable()
export class BrokerageConfigService {

    constructor(
        @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
        @InjectModel(TppData.name) private tppModel: Model<TppDataDocument>,
        @InjectModel(BrokerageConfiguration.name) private BrokerageConfiguration: Model<TppDataDocument>,
    ) { }

    async getBrokerageData(id: string) {
        
        const result = await this.BrokerageConfiguration.aggregate([
            {
                '$match': {
                    'tpp_id': id
                }
            }, {
                '$lookup': {
                    'from': 'lfi_data',
                    'localField': 'lfi_id',
                    'foreignField': 'lfi_id',
                    'as': 'lfi_data'
                }
            }, {
                '$unwind': {
                    'path': '$lfi_data'
                }
            }
        ])
        return result;
    }

    async createConfigurationData(createGlobalConfigurationDto: CreateGlobalConfigurationDto) {

        const createdConfig = new this.BrokerageConfiguration(createGlobalConfigurationDto);
        return await createdConfig.save();
    }

    async updateConfigurationData(id: string, updateGlobalConfigurationDto: CreateGlobalConfigurationDto) {

        const existingBrokerageConfiguration = await this.BrokerageConfiguration.findById(id);
        if (!existingBrokerageConfiguration) {
            throw new NotFoundException(`BrokerageConfiguration data with ID ${id} not found.`);
        }

        const updatedglobalData = await this.BrokerageConfiguration.findByIdAndUpdate(
            id,
            { $set: updateGlobalConfigurationDto },
            { new: true }
        );

        return updatedglobalData;
    }
}
