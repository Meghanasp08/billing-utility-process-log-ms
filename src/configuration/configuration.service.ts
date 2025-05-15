import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { GetglobalValueDto, UpdateglobalValueDto } from './dto/global_value.dto';
import { UpdateLfiDataDto } from './dto/lfi_update.dto';
import { GlobalConfiguration, GlobalConfigurationDocument } from './schema/global_config.schema';
import { Types } from 'mongoose';
@Injectable()
export class ConfigurationService {
    constructor(
        @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
        @InjectModel(GlobalConfiguration.name) private globalModel: Model<GlobalConfigurationDocument>,
    ) { }

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

            let options = {
                value: { $ne: 20000 },
                key:{$ne:'email'},
                Description: { $not: /Mdp rate/i },
            }

            const total = await this.globalModel.countDocuments(options).exec();

            const globalData = await this.globalModel.find(options)
            .skip(offset)
            .limit(limit)
            .exec();

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

    async getSingleGlobalDataWithFilter(getglobalValueDto: GetglobalValueDto) {
        try {

            let options = {
                key: getglobalValueDto.key
            }
            const globalData = await this.globalModel.findOne(options)
            return globalData;

        } catch (error) {
            throw new Error(`Error retrieving global data: ${error.message}`);
        }
    }

    async bulkUpdate(data: Array<{ _id: string, [key: string]: any }>) {
        const operations = data.map(item => ({
            updateOne: {
                filter: { _id: new Types.ObjectId(item._id) },
                update: { $set: item }
            }
        }));

        return await this.globalModel.bulkWrite(operations);
    }
}
