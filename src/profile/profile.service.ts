import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument } from 'src/upload/schemas/billing-log.schema';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { TppData, TppDataDocument } from 'src/upload/schemas/tpp-data.schema';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class ProfileService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
    @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
    @InjectModel(TppData.name) private tppModel: Model<TppDataDocument>,) { }

  getProfile() {
    return this.userModel.find().exec();;
  }

  async getLogData(startDate?: string, endDate?: string, search?: string) {
    const filter: any = {};

    if (startDate && endDate) {
      filter["raw_api_log_data.timestamp"] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      filter["raw_api_log_data.timestamp"] = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter["raw_api_log_data.timestamp"] = { $lte: new Date(endDate) };
    }
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter["$or"] = [
        { "raw_api_log_data.tpp_id": search },
        { "raw_api_log_data.tppName": searchRegex },
        { "raw_api_log_data.lfi_id": search },
        { "raw_api_log_data.lfiName": searchRegex }
      ];
    }
    const log = await this.logModel.find(filter).exec();
    return log;
  }

  async getBillingData(group: String, startDate?: string, endDate?: string, search?: string) {
    try {
      const filter: any = {};

      if (startDate && endDate) {
        filter["raw_api_log_data.timestamp"] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else if (startDate) {
        filter["raw_api_log_data.timestamp"] = { $gte: new Date(startDate) };
      } else if (endDate) {
        filter["raw_api_log_data.timestamp"] = { $lte: new Date(endDate) };
      }

      if (search) {
        const searchRegex = new RegExp(search, "i");
        filter["$or"] = [
          { "raw_api_log_data.tpp_id": search },
          { "raw_api_log_data.tppName": searchRegex },
          { "raw_api_log_data.lfi_id": search },
          { "raw_api_log_data.lfiName": searchRegex }
        ];
      }
      const aggregateQuery = [
        { $match: filter },
        {
          $group: {
            _id: group == 'lfi' ? "$raw_api_log_data.lfi_id" : "$raw_api_log_data.tpp_id",
            total_api_hub_fee: { $sum: "$api_hub_fee" },
            total_calculated_fee: { $sum: "$calculatedFee" },
            total_applicable_fee: { $sum: "$applicableFee" }
          }
        }
      ];

      const result = await this.logModel.aggregate(aggregateQuery).exec();
      return result;
    } catch (error) {
      console.error("Error fetching billing data:", error);
      throw new Error("Failed to fetch billing data");
    }
  }

  async getBillingDetails(id: string, group: String, startDate?: string, endDate?: string,) {
    try {
      const filter: any = {};

      if (startDate && endDate) {
        filter["raw_api_log_data.timestamp"] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else if (startDate) {
        filter["raw_api_log_data.timestamp"] = { $gte: new Date(startDate) };
      } else if (endDate) {
        filter["raw_api_log_data.timestamp"] = { $lte: new Date(endDate) };
      }

      // if (search) {
      //   const searchRegex = new RegExp(search, "i");
      //   filter["$or"] = [
      //     { "raw_api_log_data.tpp_id": search },
      //     { "raw_api_log_data.tppName": searchRegex },
      //     { "raw_api_log_data.lfi_id": search },
      //     { "raw_api_log_data.lfiName": searchRegex }
      //   ];
      // }

      const matchCondition: any = group === 'tpp'
        ? { "raw_api_log_data.tpp_id": id }
        : { "raw_api_log_data.lfi_id": id };

      const groupKey = group === 'tpp' ? "$raw_api_log_data.lfi_id" : "$raw_api_log_data.tpp_id";
      const aggregateQuery = [
        {
          $match: {
            $and: [
              matchCondition,
              filter
            ]
          }
        },
        {
          $group: {
            _id: {
              primary_key: groupKey,
              group: "$group",
              type: "$type"
            },
            type_applicable_fee: { $sum: "$api_hub_fee" },
            type_count: { $sum: 1 } // Count of documents contributing to type_applicable_fee
          }
        },
        {
          $group: {
            _id: {
              primary_key: "$_id.primary_key",
              group: "$_id.group"
            },
            group_applicable_fee: { $sum: "$type_applicable_fee" },
            group_count: { $sum: "$type_count" }, // Count of all items under this group
            types: {
              $push: {
                type: "$_id.type",
                type_applicable_fee: "$type_applicable_fee",
                type_count: "$type_count"
              }
            }
          }
        },
        {
          $group: {
            _id: "$_id.primary_key",
            total_applicable_fee: { $sum: "$group_applicable_fee" },
            total_count: { $sum: "$group_count" },
            groups: {
              $push: {
                group: "$_id.group",
                group_applicable_fee: "$group_applicable_fee",
                group_count: "$group_count",
                types: "$types"
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            primary_key: "$_id",
            total_applicable_fee: 1,
            total_count: 1,
            groups: 1
          }
        }
      ];

      const result = await this.logModel.aggregate(aggregateQuery).exec();
      return result;
    } catch (error) {
      console.error("Error fetching billing details:", error);
      throw new Error("Failed to fetch billing details");
    }
  }

  async getBillingHubDetails(id: string, startDate?: string, endDate?: string) {
    try {
      const filter: any = {};

      if (startDate && endDate) {
        filter["raw_api_log_data.timestamp"] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else if (startDate) {
        filter["raw_api_log_data.timestamp"] = { $gte: new Date(startDate) };
      } else if (endDate) {
        filter["raw_api_log_data.timestamp"] = { $lte: new Date(endDate) };
      }
      const aggregateQuery = [

        {
          $match: {
            $and: [
              { "raw_api_log_data.tpp_id": id },
              { chargeable: true },
              filter,
            ],
          },
        },

        {

          $project: {

            item: {

              $cond: {

                if: { $eq: ["$discounted", true] },

                then: "Discounted",

                else: {

                  $cond: {

                    if: {

                      $eq: ["$group", "insurance"]

                    },

                    then: "Insurance",

                    else: "Others"

                  }

                }

              }

            },

            api_hub_fee: 1

          }

        },

        {

          $group: {

            _id: "$item",

            count: { $sum: 1 },

            unit_api_hub_fee: { "$avg": "$api_hub_fee" },

            total_api_hub_fee: { $sum: "$api_hub_fee" }

          }

        },

        {

          $project: {

            _id: 0,

            item: "$_id",

            count: 1,

            unit_api_hub_fee: 1,

            total_api_hub_fee: 1

          }

        }

      ];


      const result = await this.logModel.aggregate(aggregateQuery).exec();
      return result;
    } catch (error) {
      console.error("Error fetching billing details:", error);
      throw new Error("Failed to fetch billing details");
    }
  }

  async getLfiDetails(search?: string) {
    try {
      const filter: any = {};

      if (search) {
        const searchRegex = new RegExp(search, "i");
        filter["$or"] = [
          { "lfi_id": search },
          { "lfi_name": searchRegex }
        ];
      }
      const result = await this.lfiModel.find(filter).exec();
      return result;
    } catch (error) {
      console.error("Error fetching billing details:", error);
      throw new Error("Failed to fetch billing details");
    }
  }

  async getTppDetails(search?: string) {
    try {
      const filter: any = {};

      if (search) {
        const searchRegex = new RegExp(search, "i");
        filter["$or"] = [
          { "tpp_id": search },
          { "tpp_name": searchRegex },
        ];
      }
      const result = await this.tppModel.find(filter).exec();
      return result;
    } catch (error) {
      console.error("Error fetching billing details:", error);
      throw new Error("Failed to fetch billing details");
    }
  }


}
