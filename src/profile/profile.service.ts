import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs';
import { Model } from 'mongoose';
import { Log, LogDocument } from 'src/upload/schemas/billing-log.schema';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { TppData, TppDataDocument } from 'src/upload/schemas/tpp-data.schema';
import { User, UserDocument } from './schemas/user.schema';
const { Parser } = require('json2csv');

@Injectable()
export class ProfileService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
    @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
    @InjectModel(TppData.name) private tppModel: Model<TppDataDocument>,) { }

  getProfile() {
    return this.userModel.find().exec();;
  }

  async getLogData(startDate?: string, endDate?: string, search?: string, limit: number = 100,
    offset: number = 0) {
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
    const total = await this.logModel.countDocuments(filter).exec();
    const log = await this.logModel.find(filter).skip(offset)
      .limit(limit).exec();
    return {
      log,
      pagination: {
        offset: offset,
        limit: limit,
        total: total
      }
    }
  }

  async getBillingData(group: String, startDate?: string, endDate?: string, search?: string, limit: number = 10,
    offset: number = 0) {
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
          { "raw_api_log_data.tpp_name": searchRegex },
          { "raw_api_log_data.lfi_id": search },
          { "raw_api_log_data.lfi_name": searchRegex }
        ];
      }

      const numericOffset = Number(offset);
      const numericLimit = Number(limit);
      const total = await this.logModel.countDocuments(filter).exec();
      const aggregateQuery = [
        { $match: filter },
        {
          $group: {
            _id: group === 'lfi' ? "$raw_api_log_data.lfi_id" : "$raw_api_log_data.tpp_id",
            total_api_hub_fee: { $sum: "$api_hub_fee" },
            total_calculated_fee: { $sum: "$calculatedFee" },
            total_applicable_fee: { $sum: "$applicableFee" },
          },
        },
        // { $sort: { _id: 1 as 1 | -1 } }, // Sort by _id (can customize if needed)
        { $skip: numericOffset }, // Skip records for pagination
        { $limit: numericLimit }, // Limit the number of records returned
      ];

      const result = await this.logModel.aggregate(aggregateQuery).exec();
      // return result;
      return {
        result,
        pagination: {
          offset: offset,
          limit: limit,
          total: total
        }
      }
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
          "$match": {
            "raw_api_log_data.tpp_id": id
          }
        },
        {
          "$group": {
            "_id": {
              "category": {
                "$cond": [
                  { "$eq": ["$discounted", true] },
                  "COP / Balance Check (Discounted)",
                  {
                    "$cond": [
                      { "$eq": ["$group", "insurance"] },
                      "insurance",
                      {
                        "$cond": [
                          { "$eq": ["$group", ""] },
                          "other",
                          "$group"
                        ]
                      }
                    ]
                  }
                ]
              }
            },
            "totalCount": { "$sum": 1 },
            "totalFee": { "$sum": "$api_hub_fee" },
            "singleHubFee": { "$first": "$api_hub_fee" }
          }
        },
        {
          "$match": {
            "_id.category": { "$ne": null }
          }
        },
        {
          "$project": {
            "_id": 0,
            "category": "$_id.category",
            "totalCount": 1,
            "totalFee": 1,
            "singleHubFee": 1
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

  async getLfiDetails(search?: string, limit: number = 10,
    offset: number = 0) {
    try {
      const filter: any = {};

      if (search) {
        const searchRegex = new RegExp(search, "i");
        filter["$or"] = [
          { "lfi_id": search },
          { "lfi_name": searchRegex }
        ];
      }
      // const numericOffset = Number(offset);
      // const numericLimit = Number(limit);
      const total = await this.lfiModel.countDocuments(filter).exec();
      const result = await this.lfiModel.find(filter).skip(offset)
        .limit(limit).exec();
      // return result;
      return {
        result,
        pagination: {
          offset: offset,
          limit: limit,
          total: total
        }
      }
    } catch (error) {
      console.error("Error fetching billing details:", error);
      throw new Error("Failed to fetch billing details");
    }
  }

  async getTppDetails(search?: string, limit: number = 10,
    offset: number = 0) {
    try {
      const filter: any = {};

      if (search) {
        const searchRegex = new RegExp(search, "i");
        filter["$or"] = [
          { "tpp_id": search },
          { "tpp_name": searchRegex },
        ];
      }
      const total = await this.tppModel.countDocuments(filter).exec();
      const result = await this.tppModel.find(filter).skip(offset)
        .limit(limit).exec();
      // return result;
      return {
        result,
        pagination: {
          offset: offset,
          limit: limit,
          total: total
        }
      }
    } catch (error) {
      console.error("Error fetching billing details:", error);
      throw new Error("Failed to fetch billing details");
    }
  }
  async getLogDataToCSV(startDate?: string, endDate?: string, search?: string,) {
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
    // const total = await this.logModel.countDocuments(filter).exec();
    // const log = await this.logModel.find(filter).skip(offset)
    //   .limit(limit).exec();
    const log = await this.logModel.find(filter).lean().exec();

    if (!log.length) {
      throw new Error("No data found for the given filters.");
    }

    // Flatten the log data
    const flattenedLog = log.map(({ _id, ...entry }) => ({
      ...entry.raw_api_log_data,
      ...entry.payment_logs,
      chargeable: entry.chargeable,
      lfiChargable: entry.lfiChargable,
      success: entry.success,
      group: entry.group,
      type: entry.type,
      discountType: entry.discountType,
      api_category: entry.api_category,
      discounted: entry.discounted,
      api_hub_fee: entry.api_hub_fee,
      calculatedFee: entry.calculatedFee,
      applicableFee: entry.applicableFee,
      unit_price: entry.unit_price,
      volume: entry.volume,
      appliedLimit: entry.appliedLimit,
      limitApplied: entry.limitApplied,
      isCapped: entry.isCapped,
      cappedAt: entry.cappedAt,
      numberOfPages: entry.numberOfPages,
    }));

    const outputPath = './output/log_data.csv';

    const directory = outputPath.substring(0, outputPath.lastIndexOf('/'));
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Define the CSV headers
    const fields = Object.keys(flattenedLog[0]); // Dynamically generate headers from data keys
    const parser = new Parser({ fields });
    const csv = parser.parse(flattenedLog);

    // Write the CSV file
    fs.writeFileSync(outputPath, csv, 'utf8');
    console.log(`CSV file has been created at ${outputPath}`);
    return outputPath;
  } catch(error) {
    console.error("Error creating CSV file:", error);
  }
  //     return {
  //   log,
  // }
  // }

}
