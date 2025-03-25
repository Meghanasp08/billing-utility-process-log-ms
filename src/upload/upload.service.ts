import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import { Model } from 'mongoose';
import { Log, LogDocument } from './schemas/billing-log.schema';
@Injectable()
export class UploadService {
  constructor(
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
  ) { }

  endpoints = [
    "/open-finance/account-information/v1.1/account-access-consents:GET",
    "/open-finance/payment/v1.1/payment-consents:GET",
    "/open-finance/payment/v1.1/payments:GET",
    "/open-finance/payment/v1.1/file-payments:GET",
    "/open-finance/confirmation-of-payee/v1.1/discovery:POST",
    "/open-finance/insurance/v1.1/insurance-consents:GET"
  ];

  peer_to_peer_types = ["Collection", "LargeValueCollection", "PushP2P", "PullP2PPayment"]

  payment_type_consents = ["single-immediate-payment", "multi-payment", "future-dated-payment"]

  discount = 200;
  async mergeCsvFiles(file1Path: string, file2Path: string) {
    const file1Data: any[] = [];
    const file2Data: any[] = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(file1Path)
        .pipe(csv())
        .on('data', (row) => {
          const normalizedRow: any = {};
          for (const key in row) {
            const normalizedKey = key.replace(/^\ufeff/, '').trim();
            normalizedRow[normalizedKey] = row[key];
          }
          normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
          file1Data.push(normalizedRow);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    await new Promise((resolve, reject) => {
      fs.createReadStream(file2Path)
        .pipe(csv())
        .on('data', (row) => {
          const normalizedRow: any = {};
          for (const key in row) {
            const normalizedKey = key.replace(/^\ufeff/, '').trim();
            normalizedRow[normalizedKey] = row[key];
          }
          normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
          file2Data.push(normalizedRow);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const mergedData: any[] = [];

    for (let i = 0; i < file1Data.length; i++) {
      const rawApiRecord = file1Data[i];
      const paymentRecord = file2Data[i] || {};

      const mergedRecord = {
        [`raw_api_log_data.timestamp`]: rawApiRecord.Timestamp || null,
        [`raw_api_log_data.lfi_id`]: rawApiRecord['LFI Id'] || null,
        [`raw_api_log_data.tpp_id`]: rawApiRecord['TPP Id'] || null,
        [`raw_api_log_data.tpp_client_id`]: rawApiRecord['TPP Client Id'] || null,
        [`raw_api_log_data.api_set_(sub)`]: rawApiRecord['API Set (sub)'] || null,
        [`raw_api_log_data.http_method`]: rawApiRecord['HTTP Method'] || null,
        [`raw_api_log_data.url`]: rawApiRecord.URL || null,
        [`raw_api_log_data.tpp_response_code_group`]: rawApiRecord['TPP Response Code Group'] || null,
        [`raw_api_log_data.execution_time`]: rawApiRecord['Execution Time'] || null,
        [`raw_api_log_data.interaction_id`]: rawApiRecord['Interaction Id'] || null,
        [`raw_api_log_data.resource_name`]: rawApiRecord['Resource Name'] || null,
        [`raw_api_log_data.lfi_response_code_group`]: rawApiRecord['LFI Response Code Group'] || null,
        [`raw_api_log_data.is_attended`]: rawApiRecord['Is Attended'] || null,
        [`raw_api_log_data.records`]: rawApiRecord.Records || null,
        [`raw_api_log_data.payment_type`]: rawApiRecord['Payment Type'] || null,
        [`raw_api_log_data.paymentid`]: rawApiRecord.PaymentId || null,
        [`raw_api_log_data.merchant_id`]: rawApiRecord['Merchant Id'] || null,
        [`raw_api_log_data.psu_id`]: rawApiRecord['PSU Id'] || null,
        ["raw_api_log_data.is_large_corporate"]:
          rawApiRecord['Is Large Corporate'] || null,
        [`raw_api_log_data.user_type`]: rawApiRecord['User Type'] || null,
        [`raw_api_log_data.purpose`]: rawApiRecord.Purpose || null,

        [`payment_logs.timestamp`]: paymentRecord.Timestamp || null,
        [`payment_logs.lfi_id`]: paymentRecord['LFI Id'] || null,
        [`payment_logs.tpp_id`]: paymentRecord['TPP Id'] || '',
        [`payment_logs.tpp_client_id`]: paymentRecord['TPP Client Id'] || null,
        [`payment_logs.currency`]: paymentRecord.Currency || null,
        [`payment_logs.amount`]: paymentRecord.Amount || null,
        [`payment_logs.payment_consent_type`]: paymentRecord['Payment Consent Type'] || null,
        [`payment_logs.transaction_id`]: paymentRecord['Transaction Id'] || null,
        [`payment_logs.payment_id`]: paymentRecord.PaymentId || null,
        [`payment_logs.merchant_id`]: paymentRecord['Merchant Id'] || null,
        [`payment_logs.psu_id`]: paymentRecord['PSU Id'] || null,
        [`payment_logs.is_large_corporate`]: paymentRecord['Is Large Corporate'] || null,
        [`payment_logs.number_of_successful_transactions`]: paymentRecord['Number of Successful Transactions'] || null,
        [`payment_logs.international_payment`]: paymentRecord['International Payment'] || null,
      };

      mergedData.push(mergedRecord);
    }
    const chargeFile = await this.chargableConvertion(mergedData);
    const groupFile = await this.setGroup(chargeFile);
    const feeApplied = await this.calculateFee(groupFile);
    // console.log('iam applied fee', feeApplied)
    const billData = await this.logModel.insertMany(feeApplied);
    return billData;
  }

  async pageCalculation(data: any) {
    const pageData = data.map((record: { [x: string]: string; }) => {
      let page = 1;
      let pageSize = 10;
      let total = data.length;
      let totalPages = Math.ceil(total / pageSize);
      return {
        ...record,
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: totalPages
      };
    });
    return pageData;
  }

  async calculateFee(data: any) {
    const calculatedData = data.map((record: { [x: string]: string; }) => {
      let calculatedFee = 0;
      let applicableFee = 0;
      let result: any[] = [];

      if (record.group == "payment-bulk" || record.group == "payment-non-bulk") {

        //MERCHANT CALCULATION

        if (record.type == "merchant" && record["raw_api_log_data.is_large_corporate"] != null) {

          // For Large Corporate merchants
          if (record["raw_api_log_data.is_large_corporate"] == "TRUE") {
            calculatedFee = parseInt(record["payment_logs.amount"]) * 0.0038;
            applicableFee = calculatedFee > 4 ? 4 : calculatedFee;
          }
          // For Non-Large Corporate merchants, apply the 200 AED deduction per day and merchant
          else if (record["raw_api_log_data.is_large_corporate"] == "FALSE") {

            const merchantDailyData: Record<string, any> = {};

            // Group data by merchantId and date
            data.forEach((transaction) => {
              const {
                "payment_logs.amount": rawAmount,
                "payment_logs.merchant_id": merchantId,
                "raw_api_log_data.timestamp": timestamp,
                "payment_logs.payment_id": paymentId,
              } = transaction;

              if (merchantId != record["payment_logs.merchant_id"]) {
                return; // Skip transactions that don't belong to this merchant
              }

              if (!merchantId) return;  // Skip transactions without a merchantId

              const amount = parseInt(rawAmount, 10);
              const date = new Date(timestamp).toISOString().split("T")[0];
              const key = `${merchantId}_${date}`;

              // Initialize the merchant's daily data if not already present
              if (!merchantDailyData[key]) {
                merchantDailyData[key] = {
                  merchantId,
                  date,
                  transactions: [],
                  totalAmount: 0,
                  limitApplied: false,
                  remainingBalance: this.discount,
                };
              }

              const merchantData = merchantDailyData[key];


              let appliedLimit = 0;

              // Apply the 200 AED limit per day
              if (merchantData.remainingBalance > 0) {
                appliedLimit = Math.min(merchantData.remainingBalance, amount);
                merchantData.remainingBalance -= appliedLimit; // Reduce the remaining balance
                merchantData.limitApplied = true; // Mark that the limit has been applied
              }

              // Add the transaction details (amount after limit applied)
              if (paymentId == record["raw_api_log_data.paymentid"]) {
                merchantData.transactions.push({
                  timestamp,
                  paymentId,
                  amount,
                  appliedLimit,
                  chargeableAmount: amount - appliedLimit, // Remaining chargeable amount after limit
                });

              }

              merchantData.totalAmount += amount; // Add the total amount of the day for the merchant
            });

            // Convert the merchant daily data to an array of results
            result = Object.values(merchantDailyData);
            const filteredData = result.length > 0 ? result[0].transactions.filter((filterData: { [x: string]: string; }) => {
              return filterData.paymentId == record["payment_logs.payment_id"]
            }) : [];
            calculatedFee = filteredData[0].chargeableAmount * 0.0038;
            applicableFee = parseInt(record["payment_logs.amount"]) > 20000 ? 50 : calculatedFee;
          }
        }

        //PEER-2-PEER CALCULATION

        else if (record.type == 'peer-2-peer') {
          if (record["raw_api_log_data.is_large_corporate"] == "TRUE") {
            calculatedFee = parseInt(record["payment_logs.amount"]) * 0.0038;
            applicableFee = calculatedFee > 4 ? 4 : calculatedFee;
          }
          else if (record["raw_api_log_data.is_large_corporate"] == "FALSE") {
            calculatedFee = 25;
            applicableFee = calculatedFee;
          }
        }

        //ME-2-ME CALCULATION

        else if (record.type == 'me-2-me') {
          calculatedFee = 20;
          applicableFee = calculatedFee;
        }

        //OTHER CALCULATION

        else {
          if (record.group == "payment-bulk") {
            calculatedFee = 250;
            applicableFee = calculatedFee;
          } else {
            // TO DO
          }
        }
      }

      return {
        ...record,
        calculatedFee: calculatedFee,
        applicableFee: applicableFee,
        result: result
      };
    });

    return calculatedData;
  }

  async chargableConvertion(data: any) {
    const updatedData = data.map((record: { [x: string]: string; }) => {
      let api_hub_fee = 2.5;
      let isChargeable = !this.endpoints.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
      if (isChargeable && (record["raw_api_log_data.url"].includes('confirmation-of-payee') || record["raw_api_log_data.url"].includes('balances'))) {
        const filterData = data.filter((logData: { [x: string]: string; }) => {
          return logData["raw_api_log_data.psu_id"] === record["raw_api_log_data.psu_id"] && !logData["raw_api_log_data.url"].includes('confirmation-of-payee') && !logData["raw_api_log_data.url"].includes('balances')
        })
        if (filterData.length > 0) {
          const lastRecord = filterData[0];
          const lastRecordTime = new Date(lastRecord["raw_api_log_data.timestamp"]);
          const currentRecordTime = new Date(record["raw_api_log_data.timestamp"]);
          const timeDiff = Math.abs(currentRecordTime.getTime() - lastRecordTime.getTime());
          const hours = Math.ceil(timeDiff / (1000 * 60 * 60));
          console.log('iam time diff', hours)
          if (hours <= 2) {
            api_hub_fee = 0.5;
          }
        }
      } else if (isChargeable && record["raw_api_log_data.url"].includes('insurance')) {
        api_hub_fee = 12.5;
      }
      return {
        ...record,
        chargeable: isChargeable,
        api_hub_fee: isChargeable ? api_hub_fee : 0
      };

    });
    return updatedData;
  }


  async setGroup(mergedData: any[]) {
    let group = "other";
    let type = "NA"
    return mergedData.map(logEntry => {
      if (logEntry["payment_logs.number_of_successful_transactions"] != null && logEntry["raw_api_log_data.url"].split("/").pop() == "file-payments" && logEntry['raw_api_log_data.is_large_corporate'] == true
        // && logEntry['payment_logs.is_large_corporate'] == true
      ) { // Payments (bulk) - Need to add the condition to check if the payment is fully settled
        group = "payment-bulk";
        type = this.getType(logEntry);
      } else if (this.payment_type_consents.includes(logEntry["payment_logs.payment_consent_type"]) && logEntry["raw_api_log_data.url"].split("/").pop() == "payments") {
        group = "payment-non-bulk";
        type = this.getType(logEntry);
      } else if (logEntry["raw_api_log_data.url"].indexOf("insurance") > -1) {
        group = "insurance";
        type = this.getType(logEntry);
      } else {
        group = "data";
        type = this.getType(logEntry);
      }
      return {
        ...logEntry,
        'group': group,
        'type': type
      };
    });

  }
  getType(logEntry: any) {
    let type = "other";
    if (logEntry["payment_logs.merchant_id"] != null) {
      type = "merchant";
    } else if (this.peer_to_peer_types.includes(logEntry["raw_api_log_data.payment_type"])) {
      type = "peer-2-peer";
    } else if (logEntry["raw_api_log_data.payment_type"] == "Me2Me") {
      type = "me-2-me";
    }
    return type;
  }
}

