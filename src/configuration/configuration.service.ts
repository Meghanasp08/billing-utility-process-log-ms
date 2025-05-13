import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { UpdateglobalValueDto } from './dto/global_value.dto';
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

    async updateGlobalData(id: string, updateGlobalvalueDto: UpdateglobalValueDto) {

        const existingGlobal = await this.globalModel.findById(id);
        if (!existingGlobal) {
            throw new NotFoundException(`global data with ID ${id} not found.`);
        }

        const updatedglobalData = await this.globalModel.findByIdAndUpdate(
            id,
            { $set: updateGlobalvalueDto },
            { new: true }
        );

        return updatedglobalData;
    }
    async getGlobalData(limit: number = 10, offset: number = 0) {
        try {
            const total = await this.globalModel.countDocuments({
                value: { $ne: 20000 },
                Description: { $not: /Mdp rate/i },
            }).exec();

            const globalData = await this.globalModel.find({
                value: { $ne: 20000 },
                Description: { $not: /Mdp rate/i }, // Exclude objects where Description contains "non large value" (case-insensitive)
            }).skip(offset)
                .limit(limit).exec();
            // return globalData;
            return {
                globalData,
                pagination: {
                    offset: offset,
                    limit: limit,
                    total: total
                }
            }
        } catch (error) {
            throw new Error(`Error retrieving global data: ${error.message}`);
        }
    }
}
