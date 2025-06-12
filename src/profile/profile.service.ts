import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs';
const moment = require('moment-timezone');

import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Log, LogDocument } from 'src/upload/schemas/billing-log.schema';
import { LfiData, LfiDataDocument } from 'src/upload/schemas/lfi-data.schema';
import { TppData, TppDataDocument } from 'src/upload/schemas/tpp-data.schema';
import { ChangePasswordDto } from './dto/profile.dto';
import { QueryParametersDTO } from './dto/query-parameter.dto';
import { User, UserDocument } from './schemas/user.schema';
const { Parser } = require('json2csv');

@Injectable()
export class ProfileService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
    @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
    @InjectModel(TppData.name) private tppModel: Model<TppDataDocument>,) { }

  async getProfile(users_id) {
    return await this.userModel.findById(users_id).exec();
  }

  async changePassword(changePasswordDto: ChangePasswordDto, users_id: any): Promise<any> {
    const user = await this.userModel.findById(users_id).exec();
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (changePasswordDto.new_password !== changePasswordDto.new_password) {
      throw new BadRequestException('Invalid new password');
    }
    if (await bcrypt.compare(changePasswordDto.current_password, user.password)) {
      user.password = changePasswordDto.new_password;
      await user.save();
      return true;
    } else {
      throw new BadRequestException('Invalid current password');
    }
  }

  async getLogData(queryParameters: QueryParametersDTO) {
    const filter: any = {};
    let timezone: string = moment.tz.guess();

    if (queryParameters.startDate && queryParameters.endDate) {
      filter["raw_api_log_data.timestamp"] = {
        $gte: moment.tz(queryParameters.startDate, timezone).utc().toDate(),
        $lte: moment.tz(queryParameters.endDate, timezone).utc().toDate(),
      };
    } else if (queryParameters.startDate) {
      filter["raw_api_log_data.timestamp"] = { $gte: moment.tz(queryParameters.startDate, timezone).utc().toDate(), };
    } else if (queryParameters.endDate) {
      filter["raw_api_log_data.timestamp"] = { $lte: moment.tz(queryParameters.endDate, timezone).utc().toDate(), };
    }
    if (queryParameters.group) {
      filter["group"] = queryParameters.group
    }
    if (queryParameters.type) {
      filter["type"] = queryParameters.type
    }
    if (queryParameters.lfiChargable) {
      filter["lfiChargable"] = queryParameters.lfiChargable
    }
    if (queryParameters.apiChargeable) {
      filter["chargeable"] = queryParameters.apiChargeable
    }

    if (queryParameters.search) {
      const searchRegex = new RegExp(queryParameters.search, "i");
      filter["$or"] = [
        { "raw_api_log_data.interaction_id": queryParameters.search },
        { "payment_logs.transaction_id": queryParameters.search },
        { "raw_api_log_data.payment_id": queryParameters.search },
        { "raw_api_log_data.tpp_id": queryParameters.search },
        { "raw_api_log_data.tpp_name": searchRegex },
        { "raw_api_log_data.lfi_id": queryParameters.search },
        { "raw_api_log_data.lfi_name": searchRegex }
      ];
    }
    const total = await this.logModel.countDocuments(filter).exec();
    const log = await this.logModel.find(filter).skip(queryParameters.offset)
      .limit(queryParameters.limit).lean().exec();

    // const localizedLog = log.map((entry: any) => {
    //   const timestamp = entry.raw_api_log_data?.timestamp;
    //   if (timestamp) {
    //     entry.raw_api_log_data.timestamp = moment.utc(timestamp).tz(timezone).format(); // Convert to local timezone
    //     entry.payment_logs.timestamp = moment.utc(timestamp).tz(timezone).format(); // Convert to local timezone
    //   }
    //   return entry;
    // });

    return {
      log,
      pagination: {
        offset: queryParameters.offset,
        limit: queryParameters.limit,
        total: total
      }
    }
  }

  async getLogDataNew(queryBody: any) {
    const filter: any = {};
    const { filterParams = [], offset = 0, limit = 20, search, startDate, endDate } = queryBody;

    const timezone: string = moment.tz.guess();

    // Handle Date Range
    if (startDate && endDate) {
      filter["raw_api_log_data.timestamp"] = {
        $gte: moment.tz(startDate, timezone).utc().toDate(),
        $lte: moment.tz(endDate, timezone).utc().toDate(),
      };
    } else if (startDate) {
      filter["raw_api_log_data.timestamp"] = {
        $gte: moment.tz(startDate, timezone).utc().toDate(),
      };
    } else if (endDate) {
      filter["raw_api_log_data.timestamp"] = {
        $lte: moment.tz(endDate, timezone).utc().toDate(),
      };
    }

    // Apply filterParams
    if (filterParams.length != 0) {
      for (const param of filterParams) {
        const { key, operator, value } = param;

        switch (operator) {
          case "eq":
            filter[key] = value;
            break;
          case "ne":
            filter[key] = { $ne: value };
            break;
          case "in":
            filter[key] = { $in: value };
            break;
          case "nin":
            filter[key] = { $nin: value };
            break;
          case "gte":
            filter[key] = { $gte: value };
            break;
          case "lte":
            filter[key] = { $lte: value };
            break;
          default:
            throw new Error(`Unsupported operator: ${operator}`);
        }
      }
    }


    // Search Logic
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter["$or"] = [
        { "raw_api_log_data.interaction_id": search },
        { "payment_logs.transaction_id": search },
        { "raw_api_log_data.tpp_id": search },
        { "raw_api_log_data.tpp_name": searchRegex },
        { "raw_api_log_data.lfi_id": search },
        { "raw_api_log_data.lfi_name": searchRegex }
      ];
    }

    // Querying DB
    const total = await this.logModel.countDocuments(filter).exec();
    const log = await this.logModel
      .find(filter)
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    return {
      log,
      pagination: {
        offset,
        limit,
        total
      }
    };
  }


  async getBillingData(group: String, startDate?: string, endDate?: string, search?: string, limit: number = 10,
    offset: number = 0) {
    try {
      const filter: any = {};
      let timezone: string = moment.tz.guess();
      if (startDate && endDate) {
        filter["raw_api_log_data.timestamp"] = {
          $gte: moment.tz(startDate, timezone).utc().toDate(),
          $lte: moment.tz(endDate, timezone).utc().toDate(),
        };
      } else if (startDate) {
        filter["raw_api_log_data.timestamp"] = { $gte: moment.tz(startDate, timezone).utc().toDate(), };
      } else if (endDate) {
        filter["raw_api_log_data.timestamp"] = { $lte: moment.tz(endDate, timezone).utc().toDate(), };
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
      // const total = await this.logModel.countDocuments(filter).exec();
      // const aggregateQuery = [
      //   {
      //     $match: {
      //       ...filter, // Existing filter conditions
      //       chargeable: true,
      //       success: true,
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: group === 'lfi' ? "$raw_api_log_data.lfi_id" : "$raw_api_log_data.tpp_id",
      //       ...(group === 'tpp' && {
      //         tpp_name: { $first: "$raw_api_log_data.tpp_name" },
      //       }),
      //       ...(group === 'lfi' && {
      //         lfi_name: { $first: "$raw_api_log_data.lfi_name" },
      //       }),
      //       total_api_hub_fee: { $sum: "$applicableApiHubFee" },
      //       total_calculated_fee: { $sum: "$calculatedFee" },
      //       total_applicable_fee: { $sum: "$applicableFee" },
      //     },
      //   },
      //   { $sort: { _id: 1 as 1 | -1 } },
      //   { $skip: numericOffset },
      //   { $limit: numericLimit },
      // ];
      const aggregateQuery = [
        {
          $match: {
            ...filter,
            chargeable: true,
            success: true,
          },
        },
        {
          $group: {
            _id: group === 'lfi' ? "$raw_api_log_data.lfi_id" : "$raw_api_log_data.tpp_id",
            ...(group === 'tpp' && {
              tpp_name: { $first: "$raw_api_log_data.tpp_name" },
            }),
            ...(group === 'lfi' && {
              lfi_name: { $first: "$raw_api_log_data.lfi_name" },
            }),
            total_api_hub_fee: { $sum: "$applicableApiHubFee" },
            total_calculated_fee: { $sum: "$calculatedFee" },
            total_applicable_fee: { $sum: "$applicableFee" },
          },
        },
        { $sort: { _id: 1 as 1 | -1 } },
      ];
      const paginatedQuery = [...aggregateQuery, { $skip: numericOffset }, { $limit: numericLimit }];
      const result = await this.logModel.aggregate(paginatedQuery).exec();
      const total = await this.logModel.aggregate(aggregateQuery).exec();
      // return result;
      return {
        result,
        pagination: {
          offset: offset,
          limit: limit,
          total: total.length,
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
            type_applicable_fee: { $sum: "$applicableApiHubFee" },
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
            "totalFee": { "$sum": "$applicableApiHubFee" },
            "singleHubFee": { "$first": "$applicableApiHubFee" }
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
  async getLogDataToCSV(queryParameters: QueryParametersDTO) {
    const filter: any = {};

    let timezone: string = moment.tz.guess();

    if (queryParameters.startDate && queryParameters.endDate) {
      filter["raw_api_log_data.timestamp"] = {
        $gte: moment.tz(queryParameters.startDate, timezone).utc().toDate(),
        $lte: moment.tz(queryParameters.endDate, timezone).utc().toDate(),
      };
    } else if (queryParameters.startDate) {
      filter["raw_api_log_data.timestamp"] = { $gte: moment.tz(queryParameters.startDate, timezone).utc().toDate(), };
    } else if (queryParameters.endDate) {
      filter["raw_api_log_data.timestamp"] = { $lte: moment.tz(queryParameters.endDate, timezone).utc().toDate(), };
    }
    if (queryParameters.group) {
      filter["group"] = queryParameters.group
    }
    if (queryParameters.type) {
      filter["type"] = queryParameters.type
    }
    if (queryParameters.lfiChargable) {
      filter["lfiChargable"] = queryParameters.lfiChargable
    }
    if (queryParameters.apiChargeable) {
      filter["chargeable"] = queryParameters.apiChargeable
    }

    if (queryParameters.search) {
      const searchRegex = new RegExp(queryParameters.search, "i");
      filter["$or"] = [
        { "raw_api_log_data.interaction_id": queryParameters.search },
        { "payment_logs.transaction_id": queryParameters.search },
        { "raw_api_log_data.tpp_id": queryParameters.search },
        { "raw_api_log_data.tpp_name": searchRegex },
        { "raw_api_log_data.lfi_id": queryParameters.search },
        { "raw_api_log_data.lfi_name": searchRegex }
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
      timestamp: moment
        .utc(entry.raw_api_log_data.timestamp)   // Parse as UTC
        .tz(timezone)                            // Convert to local timezone
        .format('YYYY-MM-DD HH:mm:ss'),
      lfi_id: entry.raw_api_log_data.lfi_id,
      lfi_name: entry.raw_api_log_data.lfi_name,
      tpp_id: entry.raw_api_log_data.tpp_id,
      tpp_name: entry.raw_api_log_data.tpp_name,
      tpp_client_id: entry.raw_api_log_data.tpp_client_id,
      api_set_sub: entry.raw_api_log_data.api_set_sub,
      http_method: entry.raw_api_log_data.http_method,
      url: entry.raw_api_log_data.url,
      tpp_response_code_group: entry.raw_api_log_data.tpp_response_code_group,
      execution_time: entry.raw_api_log_data.execution_time,
      interaction_id: entry.raw_api_log_data.interaction_id,
      resource_name: entry.raw_api_log_data.resource_name,
      lfi_response_code_group: entry.raw_api_log_data.lfi_response_code_group,
      is_attended: entry.raw_api_log_data.is_attended,
      records: entry.raw_api_log_data.records,
      payment_type: entry.raw_api_log_data.payment_type,
      payment_id: entry.raw_api_log_data.payment_id,
      merchant_id: entry.raw_api_log_data.merchant_id,
      psu_id: entry.raw_api_log_data.psu_id,
      is_large_corporate: entry.raw_api_log_data.is_large_corporate,
      user_type: entry.raw_api_log_data.user_type,
      purpose: entry.raw_api_log_data.purpose,
      status: entry.payment_logs.status,
      currency: entry.payment_logs.currency,
      amount: entry.payment_logs.amount,
      payment_consent_type: entry.payment_logs.payment_consent_type,
      transaction_id: entry.payment_logs.transaction_id,
      number_of_successful_transactions: entry.payment_logs.number_of_successful_transactions,
      international_payment: entry.payment_logs.international_payment,
      chargeable: entry.chargeable,
      lfiChargable: entry.lfiChargable,
      success: entry.success,
      group: entry.group,
      type: entry.type,
      discountType: entry.discountType,
      api_category: entry.api_category,
      discounted: entry.discounted,
      api_hub_fee: entry.api_hub_fee,
      applicableApiHubFee: entry.applicableApiHubFee,
      apiHubVolume: entry.apiHubVolume,
      calculatedFee: entry.calculatedFee,
      applicableFee: entry.applicableFee,
      unit_price: entry.unit_price,
      volume: entry.volume,
      appliedLimit: entry.appliedLimit,
      limitApplied: entry.limitApplied,
      isCapped: entry.isCapped,
      cappedAt: entry.cappedAt,
      numberOfPages: entry.numberOfPages,
      duplicate: entry.duplicate,
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
