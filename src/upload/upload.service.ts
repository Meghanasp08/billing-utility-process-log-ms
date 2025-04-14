import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import { Model } from 'mongoose';
import { Log, LogDocument } from './schemas/billing-log.schema';
import { ApiData, ApiDataDocument } from './schemas/endpoint.schema';
import { LfiData, LfiDataDocument } from './schemas/lfi-data.schema';
import { TppData, TppDataDocument } from './schemas/tpp-data.schema';
@Injectable()
export class UploadService {
  constructor(
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
    @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
    @InjectModel(TppData.name) private TppModel: Model<TppDataDocument>,
    @InjectModel(ApiData.name) private apiModel: Model<ApiDataDocument>,
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

  aedConstant = 100;
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

      // console.log('iam raw api record', rawApiRecord)
      // console.log('iam payment record', paymentRecord)

      // const mergedRecord = {
      //   [`raw_api_log_data.timestamp`]: rawApiRecord.Timestamp || null,
      //   [`raw_api_log_data.lfi_id`]: rawApiRecord['LFI Id'] || null,
      //   [`raw_api_log_data.tpp_id`]: rawApiRecord['TPP Id'] || null,
      //   [`raw_api_log_data.tpp_client_id`]: rawApiRecord['TPP Client Id'] || null,
      //   [`raw_api_log_data.api_set_(sub)`]: rawApiRecord['API Set (sub)'] || null,
      //   [`raw_api_log_data.http_method`]: rawApiRecord['HTTP Method'] || null,
      //   [`raw_api_log_data.url`]: rawApiRecord.URL || null,
      //   [`raw_api_log_data.tpp_response_code_group`]: rawApiRecord['TPP Response Code Group'] || null,
      //   [`raw_api_log_data.execution_time`]: rawApiRecord['Execution Time'] || null,
      //   [`raw_api_log_data.interaction_id`]: rawApiRecord['Interaction Id'] || null,
      //   [`raw_api_log_data.resource_name`]: rawApiRecord['Resource Name'] || null,
      //   [`raw_api_log_data.lfi_response_code_group`]: rawApiRecord['LFI Response Code Group'] || null,
      //   [`raw_api_log_data.is_attended`]: rawApiRecord['Is Attended'] || null,
      //   [`raw_api_log_data.records`]: rawApiRecord['Records Sent'] || null,
      //   [`raw_api_log_data.payment_type`]: rawApiRecord['Payment Type'] || null,
      //   [`raw_api_log_data.paymentid`]: rawApiRecord.PaymentId || null,
      //   [`raw_api_log_data.merchant_id`]: rawApiRecord['Merchant Id'] || null,
      //   [`raw_api_log_data.psu_id`]: rawApiRecord['PSU Id'] || null,
      //   ["raw_api_log_data.is_large_corporate"]:
      //     rawApiRecord['Is Large Corporate'] || null,
      //   [`raw_api_log_data.user_type`]: rawApiRecord['User Type'] || null,
      //   [`raw_api_log_data.purpose`]: rawApiRecord.Purpose || null,

      //   [`payment_logs.timestamp`]: paymentRecord.Timestamp || null,
      //   [`payment_logs.lfi_id`]: paymentRecord['LFI Id'] || null,
      //   [`payment_logs.tpp_id`]: paymentRecord['TPP Id'] || '',
      //   [`payment_logs.tpp_client_id`]: paymentRecord['TPP Client Id'] || null,
      //   [`payment_logs.status`]: paymentRecord['Status'] || null,
      //   [`payment_logs.currency`]: paymentRecord.Currency || null,
      //   [`payment_logs.amount`]: paymentRecord.Amount || null,
      //   [`payment_logs.payment_consent_type`]: paymentRecord['Payment Consent Type'] || null,
      //   [`payment_logs.transaction_id`]: paymentRecord['Transaction Id'] || null,
      //   [`payment_logs.payment_id`]: paymentRecord.PaymentId || null,
      //   [`payment_logs.merchant_id`]: paymentRecord['Merchant Id'] || null,
      //   [`payment_logs.psu_id`]: paymentRecord['PSU Id'] || null,
      //   [`payment_logs.is_large_corporate`]: paymentRecord['Is Large Corporate'] || null,
      //   [`payment_logs.number_of_successful_transactions`]: paymentRecord['Number of Successful Transactions'] || null,
      //   [`payment_logs.international_payment`]: paymentRecord['International Payment'] || null,
      // };
      const mergedRecord = {
        [`raw_api_log_data.timestamp`]: rawApiRecord.timestamp || null,
        [`raw_api_log_data.tpp_name`]: rawApiRecord.tppName || null,
        [`raw_api_log_data.lfi_id`]: rawApiRecord.lfiId || null,
        [`raw_api_log_data.tpp_id`]: rawApiRecord.tppId || null,
        [`raw_api_log_data.tpp_client_id`]: rawApiRecord.tppClientId || null,
        [`raw_api_log_data.api_set_(sub)`]: rawApiRecord.apiSet || null,
        [`raw_api_log_data.http_method`]: rawApiRecord.httpMethod || null,
        [`raw_api_log_data.url`]: rawApiRecord.url || null,
        [`raw_api_log_data.tpp_response_code_group`]: rawApiRecord.tppResponseCodeGroup || null,
        [`raw_api_log_data.execution_time`]: rawApiRecord.executionTime || null,
        [`raw_api_log_data.interaction_id`]: rawApiRecord.interactionId || null,
        [`raw_api_log_data.resource_name`]: rawApiRecord.resourceName || null,
        [`raw_api_log_data.lfi_response_code_group`]: rawApiRecord.lfIResponseCodeGroup || null,
        [`raw_api_log_data.is_attended`]: rawApiRecord.isAttended || null,
        [`raw_api_log_data.records`]: rawApiRecord.records || null,
        [`raw_api_log_data.payment_type`]: rawApiRecord.paymentType || null,
        [`raw_api_log_data.payment_id`]: rawApiRecord.PaymentId || null,
        [`raw_api_log_data.merchant_id`]: rawApiRecord.merchantId || null,
        [`raw_api_log_data.psu_id`]: rawApiRecord.psuId || null,
        ["raw_api_log_data.is_large_corporate"]:
          rawApiRecord.isLargeCorporate || null,
        [`raw_api_log_data.user_type`]: rawApiRecord.userType || null,
        [`raw_api_log_data.purpose`]: rawApiRecord.purpose || null,

        [`payment_logs.timestamp`]: paymentRecord.timestamp || null,
        [`payment_logs.tpp_name`]: paymentRecord.tppName || null,
        [`payment_logs.lfi_id`]: paymentRecord.lfiId || null,
        [`payment_logs.tpp_id`]: paymentRecord.tppId || '',
        [`payment_logs.tpp_client_id`]: paymentRecord.tppClientId || null,
        [`payment_logs.status`]: paymentRecord.status || null,
        [`payment_logs.currency`]: paymentRecord.currency || null,
        [`payment_logs.amount`]: paymentRecord.amount || null,
        [`payment_logs.payment_consent_type`]: paymentRecord.paymentConsentType || null,
        [`payment_logs.payment_type`]: paymentRecord.paymentType || null,
        [`payment_logs.transaction_id`]: paymentRecord.transactionId || null,
        [`payment_logs.payment_id`]: paymentRecord.PaymentId || null,
        [`payment_logs.merchant_id`]: paymentRecord.merchantId || null,
        [`payment_logs.psu_id`]: paymentRecord.psuId || null,
        [`payment_logs.is_large_corporate`]: paymentRecord.isLargeCorporate || null,
        [`payment_logs.number_of_successful_transactions`]: paymentRecord.numberOfSuccessfulTransactions || null,
        [`payment_logs.international_payment`]: paymentRecord.internationalPayment || null,
      };
      // console.log('iam merged record', mergedRecord)
      mergedData.push(mergedRecord);
      // console.log('iam count', i);

    }
    const chargeFile = await this.chargableConvertion(mergedData);
    // return chargeFile.length;
    console.log('stage 1 completed');

    const groupFile = await this.setGroup(chargeFile);
    console.log('stage 2 completed');


    const feeApplied = await this.calculateFee(groupFile);
    console.log('stage 3 completed');


    if (!feeApplied) {
      throw new Error("Fee applied data is undefined.");
    }
    console.log('stage 4 completed');

    let response = await this.populateLfiData(feeApplied);
    console.log('stage 5 completed');

    let result = await this.populateTppData(feeApplied);
    console.log('stage 6 completed');

    // // console.log('iam result', result)
    // // console.log('iam result', response)

    const pagesFeeApplied = await this.feeCalculationForLfi(feeApplied);
    console.log('stage 7 completed');

    const billData = await this.logModel.insertMany(pagesFeeApplied);
    return billData.length;
  }

  async pageCalculation(records: any) {
    let divident = 100;
    let totalPages = Math.ceil(records / divident);

    return totalPages;
  }
  async populateLfiData(rawData: any[]) {
    const uniqueLfiIds = Array.from(new Set(rawData.map(data => data["raw_api_log_data.lfi_id"])));

    const lfiDataToInsert = uniqueLfiIds.map(lfi_id => ({
      lfi_id,
      mdp_rate: parseFloat((Math.random() * (3 - 2) + 2).toFixed(2)),
      free_limit_attended: 15,
      free_limit_unattended: 5,
    }));
    console.log('lfi data insert')
    const results = [];
    for (const lfiData of lfiDataToInsert) {
      const existing = await this.lfiModel.findOne({ lfi_id: lfiData.lfi_id });
      console.log("iam hereee", lfiData)
      if (!existing) {
        // If the LFI ID does not exist, insert the data
        const inserted = await this.lfiModel.create(lfiData);
        inserted
      } else {
        console.log(`Duplicate LFI ID skipped: ${lfiData.lfi_id}`);
      }
    }

    return results;
  }

  async populateTppData(rawData: any[]) {
    const uniqueTppIds = Array.from(new Set(rawData.map(data => data["raw_api_log_data.tpp_id"])));

    const tppDataToInsert = uniqueTppIds.map(tpp_id => ({
      tpp_id,
      tpp_name: `TPP Name ${tpp_id}`,
      tpp_client_id: `TPP Client ID ${tpp_id}`,
    }));

    const results = [];
    for (const tppData of tppDataToInsert) {
      const existing = await this.TppModel.findOne({ lfi_id: tppData.tpp_id });

      if (!existing) {
        // If the LFI ID does not exist, insert the data
        const inserted = await this.TppModel.create(tppData);
        inserted
      } else {
        console.log(`Duplicate LFI ID skipped: ${tppData.tpp_id}`);
      }
    }

    return results;
  }

  // async feeCalculationForLfi(data: any) {
  //   try {
  //     const lfiCalculated = await Promise.all(
  //       data.map(async (record: { [x: string]: any }) => {
  //         if (record.group === "data" && record.type === "other") {
  //           const lfiData = await this.lfiModel.findOne({
  //             lfi_id: record["raw_api_log_data.lfi_id"],
  //           });

  //           if (!lfiData) return null; // Return null instead of pushing (filtered later)

  //           const isLargeCorporate =
  //             record["raw_api_log_data.is_large_corporate"] === "TRUE";
  //           // const lfiMdpMultiplier = isLargeCorporate
  //           //   ? lfiData.mdp_corporate
  //           //   : lfiData.mdp_retail_sme;
  //           const lfiMdpMultiplier = lfiData.mdp_rate;

  //           const margin =
  //             record["raw_api_log_data.is_attended"] == "1"
  //               ? lfiData.free_limit_attended
  //               : record["raw_api_log_data.is_attended"] == "0"
  //                 ? lfiData.free_limit_unattended
  //                 : 0;

  //           // if (margin === 0) {
  //           //   throw new Error(
  //           //     "Margin cannot be 0. Invalid value for 'is_attended'."
  //           //   );
  //           // }
  //           console.log('margin completed')
  //           const chargesData: Record<string, any> = {};

  //           // Iterate over data again to process transactions
  //           data.forEach((transaction) => {
  //             const {
  //               "raw_api_log_data.psu_id": psuId,
  //               "raw_api_log_data.timestamp": timestamp,
  //               numberOfPages,
  //             } = transaction;

  //             if (!psuId || !timestamp || !numberOfPages) return;
  //             if (psuId !== record["raw_api_log_data.psu_id"]) return;

  //             const date = new Date(timestamp).toISOString().split("T")[0];
  //             const key = `${psuId}_${date}`;

  //             if (!chargesData[key]) {
  //               chargesData[key] = {
  //                 psuId,
  //                 date,
  //                 totalPages: 0,
  //                 transactions: [],
  //               };
  //             }

  //             chargesData[key].transactions.push(transaction);
  //             chargesData[key].totalPages += numberOfPages;
  //           });
  //           console.log('charges data completed')
  //           // Generate charges per customer
  //           const customerCharges = Object.values(chargesData).map(
  //             (entry: {
  //               psuId: string;
  //               date: string;
  //               totalPages: number;
  //               transactions: any[];
  //             }) => {
  //               let chargeableTransactions =
  //                 entry.totalPages > margin ? entry.transactions.length : 0;
  //               return {
  //                 psuId: entry.psuId,
  //                 date: entry.date,
  //                 totalPages: entry.totalPages,
  //                 chargeableTransactions,
  //                 charge: chargeableTransactions * lfiMdpMultiplier,
  //               };
  //             }
  //           );
  //           console.log('customer charges completed')
  //           return {
  //             ...record,
  //             lfiResult: customerCharges.length > 0 ? customerCharges : [],
  //           };
  //         }
  //         return record; // Return unchanged if conditions are not met
  //       })
  //     );
  //     console.log(lfiCalculated, 'lfi calculated completed')
  //     return lfiCalculated // Remove null entries
  //   } catch (error) {
  //     console.error("Error calculating LFI fee:", error);
  //     throw new Error("Fee calculation failed");
  //   }
  // }

  async feeCalculationForLfi(data: any) {
    try {
      //  Step 1: Preprocess - group by psuId + date
      const psuGroupedMap: Record<string, { psuId: string; date: string; totalPages: number; transactions: any[] }> = {};

      data.forEach((transaction) => {
        const psuId = transaction["raw_api_log_data.psu_id"];
        const timestamp = transaction["raw_api_log_data.timestamp"];
        const numberOfPages = transaction.numberOfPages;

        if (!psuId || !timestamp || !numberOfPages) return;

        const date = new Date(timestamp).toISOString().split("T")[0];
        const key = `${psuId}_${date}`;

        if (!psuGroupedMap[key]) {
          psuGroupedMap[key] = {
            psuId,
            date,
            totalPages: 0,
            transactions: [],
          };
        }

        psuGroupedMap[key].transactions.push(transaction);
        psuGroupedMap[key].totalPages += numberOfPages;
      });

      //  Step 2: Process each record
      const lfiCalculated = await Promise.all(
        data.map(async (record: { [x: string]: any }) => {
          if (record.group === "data" && record.type === "other") {
            const lfiData = await this.lfiModel.findOne({
              lfi_id: record["raw_api_log_data.lfi_id"],
            });

            if (!lfiData) return record;

            const psuId = record["raw_api_log_data.psu_id"];
            const date = new Date(record["raw_api_log_data.timestamp"]).toISOString().split("T")[0];
            const key = `${psuId}_${date}`;

            const margin = record["raw_api_log_data.is_attended"] == "1"
              ? lfiData.free_limit_attended
              : record["raw_api_log_data.is_attended"] == "0"
                ? lfiData.free_limit_unattended
                : 0;

            const lfiMdpMultiplier = lfiData.mdp_rate;

            const chargesData = psuGroupedMap[key];

            if (!chargesData) {
              return { ...record, lfiResult: [] };
            }

            const chargeableTransactions =
              chargesData.totalPages > margin ? chargesData.transactions.length : 0;

            const customerCharge = {
              psuId,
              date,
              totalPages: chargesData.totalPages,
              chargeableTransactions,
              charge: chargeableTransactions * lfiMdpMultiplier,
            };

            return {
              ...record,
              lfiResult: [customerCharge],
            };
          }

          return record; // Unchanged
        })
      );

      return lfiCalculated;
    } catch (error) {
      console.error("Error calculating LFI fee:", error);
      throw new Error("Fee calculation failed");
    }
  }



  // async calculateFee(data: any) {

  //   try {
  //     const calculatedData = await Promise.all(data.map(async (record: { [x: string]: string; }) => {
  //       let calculatedFee = 0;
  //       let applicableFee = 0;
  //       let numberOfPages = 0;
  //       let result: any[] = [];
  //       // let lfiResults: any[] = [];

  //       if (record.group == "payment-bulk") {
  //         if (record['raw_api_log_data.is_large_corporate'] == 'TRUE') {

  //           calculatedFee = 250 / this.aedConstant;
  //           applicableFee = calculatedFee;
  //           record.type = "corporate";
  //         }
  //         // else if (record['raw_api_log_data.is_large_corporate'] == 'FALSE'){

  //         // }

  //       }
  //       // else {

  //       //MERCHANT CALCULATION

  //       if (record.type == "merchant") {

  //         // For Large Corporate merchants
  //         if (record["raw_api_log_data.payment_type"] == 'LargeValueCollection') {
  //           calculatedFee = parseInt(record["payment_logs.amount"]) * 0.0038;
  //           applicableFee = calculatedFee > 4 ? 4 : calculatedFee;
  //         }
  //         // For Non-Large Corporate merchants, apply the 200 AED deduction per day and merchant
  //         else {
  //           const merchantDailyData: Record<string, any> = {};

  //           // Group data by merchantId and date
  //           data.forEach((transaction) => {
  //             const {
  //               "payment_logs.amount": rawAmount,
  //               "payment_logs.merchant_id": merchantId,
  //               "raw_api_log_data.timestamp": timestamp,
  //               "payment_logs.payment_id": paymentId,
  //             } = transaction;

  //             if (merchantId != record["payment_logs.merchant_id"]) {
  //               return; // Skip transactions that don't belong to this merchant
  //             }

  //             if (!merchantId) return;  // Skip transactions without a merchantId

  //             const amount = parseInt(rawAmount, 10);
  //             const date = new Date(timestamp).toISOString().split("T")[0];
  //             const key = `${merchantId}_${date}`;

  //             // Initialize the merchant's daily data if not already present
  //             if (!merchantDailyData[key]) {
  //               merchantDailyData[key] = {
  //                 merchantId,
  //                 date,
  //                 transactions: [],
  //                 totalAmount: 0,
  //                 limitApplied: false,
  //                 remainingBalance: this.discount,
  //               };
  //             }

  //             const merchantData = merchantDailyData[key];


  //             let appliedLimit = 0;

  //             // Apply the 200 AED limit per day
  //             if (merchantData.remainingBalance > 0) {
  //               appliedLimit = Math.min(merchantData.remainingBalance, amount);
  //               merchantData.remainingBalance -= appliedLimit; // Reduce the remaining balance
  //               merchantData.limitApplied = true; // Mark that the limit has been applied
  //             }

  //             // Add the transaction details (amount after limit applied)
  //             if (paymentId == record["raw_api_log_data.paymentid"]) {
  //               merchantData.transactions.push({
  //                 timestamp,
  //                 paymentId,
  //                 amount,
  //                 appliedLimit,
  //                 chargeableAmount: amount - appliedLimit, // Remaining chargeable amount after limit
  //               });

  //             }

  //             merchantData.totalAmount += amount; // Add the total amount of the day for the merchant
  //           });

  //           // Convert the merchant daily data to an array of results
  //           result = Object.values(merchantDailyData);
  //           const filteredData = result.length > 0 ? result[0].transactions.filter((filterData: { [x: string]: string; }) => {
  //             return filterData.paymentId == record["payment_logs.payment_id"]
  //           }) : [];
  //           calculatedFee = filteredData[0].chargeableAmount * 0.0038;
  //           applicableFee = parseInt(record["payment_logs.amount"]) > 20000 ? 50 : calculatedFee;
  //         }
  //       }

  //       //PEER-2-PEER CALCULATION

  //       else if (record.type == 'peer-2-peer') {
  //         if (record["raw_api_log_data.payment_type"] == 'LargeValueCollection') {
  //           calculatedFee = parseInt(record["payment_logs.amount"]) * 0.0038;
  //           applicableFee = calculatedFee > 4 ? 4 : calculatedFee;
  //         }
  //         else {
  //           calculatedFee = 25 / this.aedConstant;
  //           applicableFee = record.group == "payment-bulk" ? calculatedFee > 250 ? 250 : calculatedFee : calculatedFee;
  //         }
  //       }

  //       //ME-2-ME CALCULATION

  //       else if (record.type == 'me-2-me') {
  //         calculatedFee = 20 / this.aedConstant;
  //         applicableFee = record.group == "payment-bulk" ? calculatedFee > 250 ? 250 : calculatedFee : calculatedFee;
  //       }

  //       //OTHER CALCULATION

  //       else {
  //         if (record.type == 'other') {
  //           if (record.group == 'insurance') {
  //             calculatedFee = 0;
  //             applicableFee = calculatedFee;
  //           } else {
  //             if (record.group == 'data') {
  //               numberOfPages = Math.ceil(parseInt(record["raw_api_log_data.records"] ?? 0) / 100);

  //               // Need to create new fundtion 
  //               // const lfiData = await this.populateLfiData(data);

  //               // let margin = record["raw_api_log_data.is_attended"] == 'true' ? 15 : record["raw_api_log_data.is_attended"] == 'false' ? 5 : 0;
  //               // if (margin === 0) {
  //               //   throw new Error("Margin cannot be 0. Invalid value for 'is_attended'.");
  //               // }
  //               // if (record["raw_api_log_data.is_attended"] == 'true') {
  //               //   lfiResults = await this.calculateLfiCharges(data, record, margin);
  //               // } else if (record["raw_api_log_data.is_attended"] == 'false') {
  //               //   lfiResults = await this.calculateLfiCharges(data, record, margin);
  //               // }

  //             } else {
  //               calculatedFee = 0;
  //               applicableFee = calculatedFee;
  //             }
  //           }
  //         }
  //       }
  //       // }

  //       return {
  //         ...record,
  //         calculatedFee: calculatedFee,
  //         applicableFee: applicableFee,
  //         result: result,
  //         numberOfPages: numberOfPages,
  //         // lfiResult: lfiResults
  //       };
  //     })
  //     );
  //     return calculatedData;
  //   } catch (error) {
  //     console.log(error)
  //   }
  // }


  async calculateFee(data: any) {
    try {
      // STEP 1: Preprocess - Group transactions by merchantId and date
      const merchantGroupedMap: Record<string, {
        merchantId: string;
        date: string;
        transactions: any[];
        totalAmount: number;
        limitApplied: boolean;
        remainingBalance: number;
      }> = {};

      for (const transaction of data) {
        const merchantId = transaction["payment_logs.merchant_id"];
        const timestamp = transaction["raw_api_log_data.timestamp"];
        const paymentId = transaction["payment_logs.payment_id"];
        const amount = parseInt(transaction["payment_logs.amount"] || "0", 10);

        if (!merchantId || !timestamp) continue;

        const date = new Date(timestamp).toISOString().split("T")[0];
        const key = `${merchantId}_${date}`;

        if (!merchantGroupedMap[key]) {
          merchantGroupedMap[key] = {
            merchantId,
            date,
            transactions: [],
            totalAmount: 0,
            limitApplied: false,
            remainingBalance: this.discount,
          };
        }

        const group = merchantGroupedMap[key];

        let appliedLimit = 0;
        if (group.remainingBalance > 0) {
          appliedLimit = Math.min(group.remainingBalance, amount);
          group.remainingBalance -= appliedLimit;
          group.limitApplied = true;
        }

        group.transactions.push({
          timestamp,
          paymentId,
          amount,
          appliedLimit,
          chargeableAmount: amount - appliedLimit,
        });

        group.totalAmount += amount;
      }

      // STEP 2: Now map and use fast lookup
      const calculatedData = await Promise.all(data.map(async (record: { [x: string]: string; }) => {
        let calculatedFee = 0;
        let applicableFee = 0;
        let numberOfPages = 0;
        let result: any[] = [];

        if (record.group === "payment-bulk" && record['raw_api_log_data.is_large_corporate'] === 'TRUE') {
          calculatedFee = 250 / this.aedConstant;
          applicableFee = calculatedFee;
          record.type = "corporate";
        }

        // MERCHANT CALCULATION
        if (record.type === "merchant") {
          if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
            calculatedFee = parseInt(record["payment_logs.amount"]) * 0.0038;
            applicableFee = calculatedFee > 4 ? 4 : calculatedFee;
          } else {
            const date = new Date(record["raw_api_log_data.timestamp"]).toISOString().split("T")[0];
            const key = `${record["payment_logs.merchant_id"]}_${date}`;
            const merchantGroup = merchantGroupedMap[key];

            if (merchantGroup) {
              result = [merchantGroup]; // For consistency if needed in frontend
              const filteredTransaction = merchantGroup.transactions.find((t) =>
                t.paymentId === record["payment_logs.payment_id"]
              );

              if (filteredTransaction) {
                calculatedFee = filteredTransaction.chargeableAmount * 0.0038;
                applicableFee = parseInt(record["payment_logs.amount"]) > 20000 ? 50 : calculatedFee;
              }
            }
          }
        }

        // PEER-2-PEER
        else if (record.type === 'peer-2-peer') {
          if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
            calculatedFee = parseInt(record["payment_logs.amount"]) * 0.0038;
            applicableFee = calculatedFee > 4 ? 4 : calculatedFee;
          } else {
            calculatedFee = 25 / this.aedConstant;
            applicableFee = record.group === "payment-bulk"
              ? calculatedFee > 250 ? 250 : calculatedFee
              : calculatedFee;
          }
        }

        // ME-2-ME
        else if (record.type === 'me-2-me') {
          calculatedFee = 20 / this.aedConstant;
          applicableFee = record.group === "payment-bulk"
            ? calculatedFee > 250 ? 250 : calculatedFee
            : calculatedFee;
        }

        // OTHER
        else if (record.type === 'other') {
          if (record.group === 'insurance') {
            calculatedFee = 0;
            applicableFee = calculatedFee;
          } else if (record.group === 'data') {
            numberOfPages = Math.ceil(parseInt(record["raw_api_log_data.records"] ?? "0") / 100);
            // Future LFI logic would be called here
          } else {
            calculatedFee = 0;
            applicableFee = calculatedFee;
          }
        }

        return {
          ...record,
          calculatedFee,
          applicableFee,
          result,
          numberOfPages,
        };
      }));

      return calculatedData;
    } catch (error) {
      console.error("Error in calculateFee:", error);
      throw new Error("Fee calculation failed");
    }
  }


  async chargableConvertion(data: any) {
    const updatedData = data.map(async (record: { [x: string]: string; }) => {
      let discounted = false;
      let api_hub_fee = 2.5 / this.aedConstant;
      // let isChargeable = !this.endpoints.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
      let apiData = await this.apiModel.find({ chargeable_api_hub_fee: true, chargeable_LFI_TPP_fee: true });
      let chargableUrls = apiData
        .filter(api => api.chargeable_api_hub_fee === true)
        .map(api => `${api.api_spec}${api.api_endpoint}:${record["raw_api_log_data.http_method"]}`);

      let lfiChargableUrls = apiData
        .filter(api => api.chargeable_LFI_TPP_fee === true)
        .map(api => `${api.api_spec}${api.api_endpoint}:${record["raw_api_log_data.http_method"]}`);
      let isChargeable = chargableUrls.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
      let islfiChargable = chargableUrls.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
      let success = record["raw_api_log_data.tpp_response_code_group"] == "2xx" && record["raw_api_log_data.lfi_response_code_group"] == "2xx";
      if (record["raw_api_log_data.psu_id"] != null && isChargeable && (record["raw_api_log_data.url"].includes('confirmation-of-payee') || record["raw_api_log_data.url"].includes('balances'))) {
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
            api_hub_fee = 0.5 / this.aedConstant;
            discounted = true
          }
        }
      } else if (isChargeable && record["raw_api_log_data.url"]?.includes('insurance')) {
        api_hub_fee = 12.5 / this.aedConstant;
      }
      return {
        ...record,
        chargeable: isChargeable,
        lfiChargable: islfiChargable,
        success: success,
        discounted: discounted,
        api_hub_fee: isChargeable ? api_hub_fee : 0,
      };

    });
    return updatedData;
  }


  async setGroup(mergedData: any[]) {
    let group = "other";
    let type = "NA"
    return mergedData.map(logEntry => {
      if (logEntry["payment_logs.number_of_successful_transactions"] != null && logEntry["raw_api_log_data.url"].split("/").pop() == "file-payments") { // Payments (bulk) - Need to add the condition to check if the payment is fully settled
        group = "payment-bulk";
        type = this.getType(logEntry);
      } else if (this.payment_type_consents.includes(logEntry["payment_logs.payment_consent_type"]) && logEntry["raw_api_log_data.url"].split("/").pop() == "payments") {
        group = "payment-non-bulk";
        type = this.getType(logEntry);
      } else if (logEntry["raw_api_log_data.url"]?.indexOf("insurance") > -1) {
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



  async getapis() {
    const data = await this.apiModel.find().limit(10);
    console.log('iam data', data)
    return data;
  }
}

