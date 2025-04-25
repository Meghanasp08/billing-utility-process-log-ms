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

  async getLogData(startDate?: string, endDate?: string, search?: string, limit: number = 10,
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
    const log = await this.logModel.find(filter).exec();

    const outputPath = './output/log_data.csv';

    const directory = outputPath.substring(0, outputPath.lastIndexOf('/'));
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Define the CSV headers
    const fields = [
      "raw_api_log_data.timestamp",
      "raw_api_log_data.tpp_name",
      "raw_api_log_data.lfi_id",
      "raw_api_log_data.tpp_id",
      "raw_api_log_data.tpp_client_id",
      "raw_api_log_data.api_set_sub",
      "raw_api_log_data.http_method",
      "raw_api_log_data.url",
      "raw_api_log_data.tpp_response_code_group",
      "raw_api_log_data.execution_time",
      "raw_api_log_data.interaction_id",
      "raw_api_log_data.resource_name",
      "raw_api_log_data.lfi_response_code_group",
      "raw_api_log_data.is_attended",
      "raw_api_log_data.records",
      "raw_api_log_data.payment_type",
      "raw_api_log_data.payment_id",
      "raw_api_log_data.merchant_id",
      "raw_api_log_data.psu_id",
      "raw_api_log_data.is_large_corporate",
      "raw_api_log_data.user_type",
      "raw_api_log_data.purpose",
      "payment_logs.timestamp",
      "payment_logs.tpp_name",
      "payment_logs.lfi_id",
      "payment_logs.tpp_id",
      "payment_logs.tpp_client_id",
      "payment_logs.status",
      "payment_logs.currency",
      "payment_logs.amount",
      "payment_logs.payment_consent_type",
      "payment_logs.payment_type",
      "payment_logs.transaction_id",
      "payment_logs.payment_id",
      "payment_logs.merchant_id",
      "payment_logs.psu_id",
      "payment_logs.is_large_corporate",
      "payment_logs.number_of_successful_transactions",
      "payment_logs.international_payment",
      "chargeable",
      "lfiChargable",
      "success",
      "group",
      "type",
      "discountType",
      "api_category",
      "discounted",
      "api_hub_fee",
      "calculatedFee",
      "applicableFee",
      "unit_price",
      "volume",
      "appliedLimit",
      "limitApplied",
      "isCapped",
      "cappedAt",
      "numberOfPages"
    ];

    // Convert JSON to CSV
    const parser = new Parser({ fields });
    const csv = parser.parse(log);

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
