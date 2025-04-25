import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { UpdateLfiDataDto } from './dto/lfi_update.dto';
import { GlobalConfiguration, GlobalConfigurationDocument } from './schema/global_config.schema';

@Injectable()
export class ConfigurationService {
    constructor(@InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
        @InjectModel(GlobalConfiguration.name) private globalModel: Model<GlobalConfigurationDocument>,) { }
    async updateLfiData(id: string, updateLfiDataDto: UpdateLfiDataDto) {

        const existingLfi = await this.lfiModel.findById(id);
        if (!existingLfi) {
            throw new NotFoundException(`LFI with ID ${id} not found.`);
        }

        const updatedLfi = await this.lfiModel.findByIdAndUpdate(
            id,
            { $set: updateLfiDataDto },
            { new: true }
        );

        return updatedLfi;
    }

    async getGlobalData(): Promise<GlobalConfiguration[]> {
        try {
            const globalData = await this.globalModel.find().exec();
            return globalData;
        } catch (error) {
            throw new Error(`Error retrieving global data: ${error.message}`);
        }
    }
}
