import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { filter_master, paymentLabelFilters } from 'src/config/app.config';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { TppData, TppDataDocument } from 'src/upload/schemas/tpp-data.schema';
import { CreateApiDto, GetglobalValueDto, UpdateApiDto, UpdateglobalValueDto } from './dto/global_value.dto';
import { UpdateLfiDataDto } from './dto/lfi_update.dto';
import { UpdateTppDataDto } from './dto/tpp_update.dto';
import { ApiDataConfiguration, ApiDataConfigurationDocument } from './schema/api_data.schema';
import { GlobalConfiguration, GlobalConfigurationDocument } from './schema/global_config.schema';
@Injectable()
export class ConfigurationService {
    constructor(
        @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
        @InjectModel(TppData.name) private tppModel: Model<TppDataDocument>,
        @InjectModel(GlobalConfiguration.name) private globalModel: Model<GlobalConfigurationDocument>,
        @InjectModel(ApiDataConfiguration.name) private apiDataModel: Model<ApiDataConfigurationDocument>,
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

    async updateTppData(id: string, updateTppDataDto: UpdateTppDataDto) {

        const existingTpp = await this.tppModel.findById(id);
        if (!existingTpp) {
            throw new NotFoundException(`TPP with ID ${id} not found.`);
        }

        const updatedTpp = await this.tppModel.findByIdAndUpdate(
            id,
            { $set: updateTppDataDto },
            { new: true }
        );

        return updatedTpp;
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
                key: { $ne: 'email' },
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


    async getApiData() {
        try {
            const allData = await this.apiDataModel.find().sort({ createdAt: -1 }).lean<any>();

            const categorizedData = allData.reduce((acc, item) => {
                const category = item.api_category;
                if (!acc[category]) acc[category] = [];
                acc[category].push(item);
                return acc;
            }, {});

            return categorizedData;
        } catch (error) {
            throw new Error(`Error retrieving API data: ${error.message}`);
        }
    }



    async updateApidatas(updateApiDto: UpdateApiDto) {
        try {
            const existingApi = await this.apiDataModel.findById(updateApiDto._id);
            if (!existingApi) {
                throw new NotFoundException(`API data with ID ${updateApiDto._id} not found.`);
            }
            const updatedApi = await this.apiDataModel.findByIdAndUpdate(
                updateApiDto._id,
                { $set: updateApiDto },
                { new: true }
            );
            return updatedApi;
        } catch (error) {
            throw new Error(`Error retrieving api data: ${error.message}`);
        }
    }

    async createApidatas(createApiDto: CreateApiDto) {
        try {
            console.log(createApiDto, 'createApiDto');
            const existingApi = await this.apiDataModel.findOne({ api_endpoint: createApiDto.api_endpoint, api_operation: createApiDto.api_operation });
            if (existingApi) {
                throw new NotFoundException(`API data with url and api operation ${createApiDto.api_endpoint} ${createApiDto.api_operation} already exists.`);
            }
            const newApi = await this.apiDataModel.create(createApiDto);
            return newApi;
        } catch (error) {
            throw new Error(`Error creating api data: ${error.message}`);
        }
    }

    async getFilterList() {
        try {
            return filter_master;
        } catch (error) {
            throw new Error(`Error Getting Filter Data: ${error.message}`);
        }
    }

    async getPaymentFilter() {
        try {
            return paymentLabelFilters;
        } catch (error) {
            throw new Error(`Error Getting Filter Data: ${error.message}`);
        }
    }

}
