import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument } from 'src/upload/schemas/billing-log.schema';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class ProfileService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Log.name) private logModel: Model<LogDocument>,) { }

  getProfile() {
    return this.userModel.find().exec();;
  }

  async getLogData() {
    const log = await this.logModel.find().exec();
    return log;
  }

  async getBillingData() {
    try {
      const aggregateQuery = [
        {
          $group: {
            _id: "$raw_api_log_data.tpp_id",
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

  async getBillingDetails(id: string) {
    try {
      const aggregateQuery = [
        {
          $match: {
            "raw_api_log_data.tpp_id": id
          }
        },
        {
          $group: {
            _id: {
              lfi_id: "$raw_api_log_data.lfi_id",
              group: "$group",
              type: "$type"
            },
            type_applicable_fee: { $sum: "$api_hub_fee" }
          }
        },
        {
          $group: {
            _id: {
              lfi_id: "$_id.lfi_id",
              group: "$_id.group"
            },
            group_applicable_fee: { $sum: "$type_applicable_fee" },
            types: {
              $push: {
                type: "$_id.type",
                type_applicable_fee: "$type_applicable_fee"
              }
            }
          }
        },
        {
          $group: {
            _id: "$_id.lfi_id",
            total_applicable_fee: { $sum: "$group_applicable_fee" },
            groups: {
              $push: {
                group: "$_id.group",
                group_applicable_fee: "$group_applicable_fee",
                types: "$types"
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            lfi_id: "$_id",
            total_applicable_fee: 1,
            groups: 1
          }
        }
      ]

      const result = await this.logModel.aggregate(aggregateQuery).exec();
      return result;
    } catch (error) {
      console.error("Error fetching billing details:", error);
      throw new Error("Failed to fetch billing details");
    }
  }

}
