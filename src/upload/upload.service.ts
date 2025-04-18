import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import { Model } from 'mongoose';
import { AppConfig } from 'src/config/app.config';
import { Log, LogDocument } from './schemas/billing-log.schema';
import { ApiData, ApiDataDocument } from './schemas/endpoint.schema';
import { LfiData, LfiDataDocument } from './schemas/lfi-data.schema';
import { MerchantTransaction, MerchantTransactionDocument } from './schemas/merchant.limitapplied.schema';
import { PageMultiplier, PageMultiplierDocument } from './schemas/pagemultiplier.schema';
import { TppData, TppDataDocument } from './schemas/tpp-data.schema';
@Injectable()
export class UploadService {
  constructor(
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
    @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
    @InjectModel(TppData.name) private TppModel: Model<TppDataDocument>,
    @InjectModel(ApiData.name) private apiModel: Model<ApiDataDocument>,
    @InjectModel(MerchantTransaction.name) private merchantLimitModel: Model<MerchantTransactionDocument>,
    @InjectModel(PageMultiplier.name) private pageMultiplier: Model<PageMultiplierDocument>,
  ) { }

  private readonly endpoints = AppConfig.endpoints;
  private readonly peer_to_peer_types = AppConfig.peerToPeerTypes;
  private readonly payment_type_consents = AppConfig.paymentTypeConsents;
  private readonly discount = AppConfig.discount;
  private readonly aedConstant = AppConfig.aedConstant;

  async mergeCsvFiles(file1Path: string, file2Path: string) {
    const file1Data: any[] = [];
    const file2Data: any[] = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(file1Path)
        .pipe(csv())
        .on('data', (row) => {
          const normalizedRow: any = {};
          let isEmptyRow = true;

          for (const key in row) {
            const normalizedKey = key.replace(/^\ufeff/, '').trim();
            const value = row[key]?.trim();

            normalizedRow[normalizedKey] = value;
            if (value) isEmptyRow = false; // Mark row as non-empty if any field has a value
          }

          // Only add non-empty rows
          if (!isEmptyRow) {
            normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
            file1Data.push(normalizedRow);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    await new Promise((resolve, reject) => {
      fs.createReadStream(file2Path)
        .pipe(csv())
        .on('data', (row) => {
          const normalizedRow: any = {};
          let isEmptyRow = true;

          for (const key in row) {
            const normalizedKey = key.replace(/^\ufeff/, '').trim();
            const value = row[key]?.trim();

            normalizedRow[normalizedKey] = value;
            if (value) isEmptyRow = false; // Mark row as non-empty if any field has a value
          }

          // Only add non-empty rows
          if (!isEmptyRow) {
            normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
            file2Data.push(normalizedRow);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(file1Data.length, 'raw api record')
    console.log(file2Data.length, 'raw api record')

    const mergedData: any[] = [];
    for (let i = 0; i < file1Data.length; i++) {
      const rawApiRecord = file1Data[i];
      const paymentRecord = file2Data[i] || {};
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
    // console.log('iam merged data', mergedData)
    const chargeFile = await this.chargableConvertion(mergedData);
    console.log('stage 1 completed');
    // return chargeFile




    const feeApplied = await this.calculateFee(chargeFile);
    console.log('stage 3 completed');
    // return feeApplied;


    // if (!feeApplied) {
    //   throw new Error("Fee applied data is undefined.");
    // }
    // console.log('stage 4 completed');

    let response = await this.populateLfiData(feeApplied);
    console.log('stage 5 completed');

    let result = await this.populateTppData(feeApplied);
    console.log('stage 6 completed');

    // // // console.log('iam result', result)
    // // // console.log('iam result', response)

    const pagesFeeApplied = await this.feeCalculationForLfi(feeApplied);
    console.log('stage 7 completed');
    // return pagesFeeApplied;

    const pageDataCalculation = await this.attendedUpdateOnNumberOfPage(pagesFeeApplied);
    // return pageDataCalculation;
    const billData = await this.logModel.insertMany(pagesFeeApplied);
    return billData.length;
  }
  async attendedUpdateOnNumberOfPage(data: any) {
    let lfiPageDataArray: any[] = [];
    const updatedData = data.map((record: any) => {
      if (record.lfiResult && record.lfiResult.length > 0) {
        const outerData = record.lfiResult.find(txn => txn.paymentId == record['payment_logs.payment_id']);
        console.log('iam outer data', outerData)
        record.calculatedFee = outerData.charge;
        record.applicableFee = record.calculatedFee
        lfiPageDataArray.push(record.lfiResult, record.summary)
        delete record.lfiResult;
        delete record.summary;
        return {
          ...record,
          appliedLimit: outerData.appliedLimit,
          chargeableAmount: outerData.chargeableAmount,
          // charge: outerData.charge,
          unit_price: outerData.mdp_rate,
        };
      }

      return record;
    });

    const uniqueLfiPageData = await this.processData(lfiPageDataArray);
    const existingMulti = await this.pageMultiplier.findOne({
      "summary.psuId": uniqueLfiPageData.summary.psuId,
      'summary.date': uniqueLfiPageData.summary.date
    });
    if (!existingMulti) {
      const lfiPageData = await this.pageMultiplier.insertMany(uniqueLfiPageData);
    }

    return updatedData;
  }

  async processData(input) {
    const uniqueTransactions = new Map();

    input.forEach((item) => {
      if (Array.isArray(item)) {
        item.forEach((transaction) => {
          uniqueTransactions.set(transaction.paymentId, transaction);
        });
      }
    });

    const summary = input.find((item) => item.psuId) || {};

    return {
      transactions: Array.from(uniqueTransactions.values()),
      summary,
    };
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
    const results = [];
    for (const lfiData of lfiDataToInsert) {
      const existing = await this.lfiModel.findOne({ lfi_id: lfiData.lfi_id });
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

    for (const tppData of tppDataToInsert) {
      try {
        // Atomic check-and-insert operation
        await this.TppModel.updateOne(
          { tpp_id: tppData.tpp_id }, // Filter for existing record
          { $setOnInsert: tppData }, // Insert only if not found
          { upsert: true }           // Create new document if no match is found
        );
      } catch (error) {
        console.error(`Error processing TPP ID ${tppData.tpp_id}:`, error.message);
      }
    }

    return `Processed ${tppDataToInsert.length} TPP records.`;
  }

  async feeCalculationForLfi(data: any) {
    try {
      // Step 1: Preprocess - group by psuId + date + is_attended
      const psuGroupedMap: Record<
        string,
        { psuId: string; date: string; isAttended: string; totalPages: number; transactions: any[] }
      > = {};

      data.forEach((transaction) => {
        if (transaction.lfiChargable && transaction.success && transaction.group === "data" && transaction.type === "NA") {
          const psuId = transaction["raw_api_log_data.psu_id"];
          const timestamp = transaction["raw_api_log_data.timestamp"];
          const numberOfPages = transaction.numberOfPages;
          const isAttended = transaction["raw_api_log_data.is_attended"];

          if (!psuId || !timestamp || !numberOfPages || isAttended === undefined) return;

          const date = new Date(timestamp).toISOString().split("T")[0];
          const key = `${psuId}_${date}_${isAttended}`;

          if (!psuGroupedMap[key]) {
            psuGroupedMap[key] = {
              psuId,
              date,
              isAttended,
              totalPages: 0,
              transactions: [],
            };
          }

          psuGroupedMap[key].transactions.push(transaction);
          psuGroupedMap[key].totalPages += numberOfPages;
        }
      });

      // Step 2: Process each record
      const lfiCalculated = await Promise.all(
        data.map(async (record: { [x: string]: any }) => {
          if (record.group === "data" && record.type === "NA" && record.lfiChargable && record.success) {
            if (Boolean(record["raw_api_log_data.is_large_corporate"])) {
              record.type = "corporate";
            }

            const lfiData = await this.lfiModel.findOne({
              lfi_id: record["raw_api_log_data.lfi_id"],
            });

            if (!lfiData) return record;

            const psuId = record["raw_api_log_data.psu_id"];
            const date = new Date(record["raw_api_log_data.timestamp"]).toISOString().split("T")[0];
            const isAttended = record["raw_api_log_data.is_attended"];
            const key = `${psuId}_${date}_${isAttended}`;

            const margin =
              Boolean(isAttended) === true
                ? lfiData.free_limit_attended
                : Boolean(isAttended) === false
                  ? lfiData.free_limit_unattended
                  : 0;

            const lfiMdpMultiplier = record['raw_api_log_data.is_large_corporate'] ? 40 / this.aedConstant : lfiData.mdp_rate;

            const chargesData = psuGroupedMap[key];

            if (!chargesData) {
              return { ...record, lfiResult: [] };
            }

            // Apply discount logic
            let remainingMargin = margin;
            const processedTransactions = chargesData.transactions.map((txn) => {
              const appliedLimit = Math.min(remainingMargin, txn.numberOfPages);
              remainingMargin -= appliedLimit;

              const chargeableAmount = txn.numberOfPages - appliedLimit;
              const charge = chargeableAmount * lfiMdpMultiplier;

              return {
                ...txn,
                paymentId: txn["payment_logs.payment_id"],
                mdp_rate: lfiMdpMultiplier,
                appliedLimit,
                chargeableAmount,
                charge,
              };
            });


            const totalCharge = processedTransactions.reduce((acc, txn) => acc + txn.charge, 0);

            const customerCharge = {
              psuId,
              date,
              totalPages: chargesData.totalPages,
              chargeableTransactions: processedTransactions.length,
              charge: totalCharge,
            };

            return {
              ...record,
              lfiResult: processedTransactions,
              summary: customerCharge,
            };
          }


          return record; // Unchanged
        })
      );

      return lfiCalculated.map((record) => {
        // Return a simplified structure
        if (record.lfiResult && record.lfiResult.length > 0) {
          return {
            ...record,
            lfiResult: record.lfiResult.map((txn: any) => ({
              // raw_api_log_data: txn["raw_api_log_data"],
              // payment_logs: txn["payment_logs"],
              appliedLimit: txn.appliedLimit,
              chargeableAmount: txn.chargeableAmount,
              charge: txn.charge,
              paymentId: txn.paymentId,
              tpp_id: txn["raw_api_log_data.tpp_id"],
              lfi_id: txn["raw_api_log_data.lfi_id"],
              isAttended: Boolean(txn["raw_api_log_data.is_attended"]),
              mdp_rate: txn.mdp_rate,
            })),
            summary: record.summary,
          };
        }
        return record;
      });
    } catch (error) {
      console.error("Error calculating LFI fee:", error);
      throw new Error("Fee calculation failed");
    }
  }


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
        // if (!transaction.lfiChargable && !transaction.success) continue; // Skip if not chargeable
        if (transaction.lfiChargable && transaction.success) {

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
      }
      let merchantArray: any[] = [];

      // STEP 2: Now map and use fast lookup
      const calculatedData = await Promise.all(data.map(async (record: { [x: string]: string; }) => {

        let calculatedFee = 0;
        let applicableFee = 0;
        let numberOfPages = 0;
        let result: any[] = [];
        let unit_price = 0;
        let chargeableAmount = 0;
        let appliedLimit = 0;
        let limitApplied = false;
        if (record.lfiChargable && record.success) {

          if (record.group === "payment-bulk" && Boolean(record['raw_api_log_data.is_large_corporate'])) {
            calculatedFee = 250 / this.aedConstant;
            applicableFee = calculatedFee;
            record.type = "corporate";
          }

          // MERCHANT CALCULATION
          if (record.type === "merchant") {

            if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
              // calculatedFee = parseInt(record["payment_logs.amount"]) * 0.0038;
              // applicableFee = calculatedFee > 4 ? 4 : calculatedFee;
              calculatedFee = parseFloat((parseInt(record["payment_logs.amount"]) * 0.0038).toFixed(3));
              applicableFee = parseFloat((calculatedFee > 4 ? 4 : calculatedFee).toFixed(3));
              unit_price = 0.0038;
              chargeableAmount = parseInt(record["payment_logs.amount"]);
            } else {
              const date = new Date(record["raw_api_log_data.timestamp"]).toISOString().split("T")[0];
              const key = `${record["payment_logs.merchant_id"]}_${date}`;
              const merchantGroup = merchantGroupedMap[key];

              if (merchantGroup) {
                result = [merchantGroup]; // For consistency if needed in frontend
                if (result.length > 0) {
                  merchantArray.push(merchantGroup);

                }
                const filteredTransaction = merchantGroup.transactions.find((t) =>
                  t.paymentId === record["payment_logs.payment_id"]
                );

                if (filteredTransaction) {
                  console.log('iam filtered transaction', filteredTransaction);
                  // calculatedFee = filteredTransaction.chargeableAmount * 0.0038;
                  // applicableFee = parseInt(record["payment_logs.amount"]) > 20000 ? 50 : calculatedFee;
                  calculatedFee = parseFloat((filteredTransaction.chargeableAmount * 0.0038).toFixed(3));
                  applicableFee = parseFloat((parseInt(record["payment_logs.amount"]) > 20000 ? 50 : calculatedFee).toFixed(3));
                  unit_price = 0.0038;
                  chargeableAmount = filteredTransaction.chargeableAmount;
                  appliedLimit = filteredTransaction.appliedLimit;
                  limitApplied = merchantGroup.limitApplied;

                }
              }
            }

          }

          // PEER-2-PEER
          else if (record.type === 'peer-2-peer') {
            if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
              calculatedFee = parseFloat((parseInt(record["payment_logs.amount"]) * 0.0038).toFixed(3));
              applicableFee = parseFloat((calculatedFee > 4 ? 4 : calculatedFee).toFixed(3));
              unit_price = 0.0038;
              chargeableAmount = parseInt(record["payment_logs.amount"]);
            } else {
              calculatedFee = parseFloat((25 / this.aedConstant).toFixed(3));
              applicableFee = parseFloat((record.group === "payment-bulk"
                ? (calculatedFee > 2.50 ? 2.50 : calculatedFee)
                : calculatedFee).toFixed(3));
            }
          }

          // ME-2-ME
          else if (record.type === 'me-2-me') {
            // calculatedFee = 20 / this.aedConstant;
            // applicableFee = record.group === "payment-bulk"
            //   ? calculatedFee > 250 ? 250 : calculatedFee
            //   : calculatedFee;
            calculatedFee = parseFloat((25 / this.aedConstant).toFixed(3));
            applicableFee = parseFloat((record.group === "payment-bulk"
              ? (calculatedFee > 2.50 ? 2.50 : calculatedFee)
              : calculatedFee).toFixed(3));
          }

          // OTHER
          else if (record.type === 'NA') {
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
        }

        return {
          ...record,
          calculatedFee,
          applicableFee,
          unit_price,
          chargeableAmount,
          appliedLimit,
          limitApplied,
          // result,
          numberOfPages,
        };
      }));

      const uniqueMerchantsMap = new Map();

      merchantArray.forEach((merchant) => {
        if (!uniqueMerchantsMap.has(merchant.merchantId)) {
          uniqueMerchantsMap.set(merchant.merchantId, merchant);
        }
      });

      // Convert the unique map values back to an array
      const uniqueMerchants = Array.from(uniqueMerchantsMap.values());

      // Process each unique merchant
      if (uniqueMerchants.length > 0) {
        console.log('Unique merchants:', uniqueMerchants);

        for (const merchant of uniqueMerchants) {
          const existingMerchant = await this.merchantLimitModel.findOne({ merchantId: merchant.merchantId });

          if (!existingMerchant) {
            await this.merchantLimitModel.insertMany(merchant);
            console.log(`Inserted merchant with ID ${merchant.merchantId}`);
          } else {
            console.log(`Merchant with ID ${merchant.merchantId} already exists. Skipping insertion.`);
          }
        }
      }


      return calculatedData;
    } catch (error) {
      console.error("Error in calculateFee:", error);
      throw new Error("Fee calculation failed");
    }
  }


  // async chargableConvertion(data: any) {
  //   let group = "Other";
  //   let apiData = await this.apiModel.find({
  //     $or: [
  //       { chargeable_api_hub_fee: true },
  //       { chargeable_LFI_TPP_fee: true }
  //     ]
  //   });

  //   // Generate chargeable URLs outside the map loop
  //   let chargableUrls = apiData
  //     .filter(api => api.chargeable_api_hub_fee === true)
  //     .map(api => `${api.api_spec}${api.api_endpoint}:${api.api_operation.toUpperCase()}`);

  //   let lfiChargableUrls = apiData
  //     .filter(api => api.chargeable_LFI_TPP_fee === true)
  //     .map(api => `${api.api_spec}${api.api_endpoint}:${api.api_operation.toUpperCase()}`);

  //   const updatedData = await Promise.all(data.map(async (record: { [x: string]: string; }) => {
  //     let discounted = false;
  //     let api_hub_fee = 2.5 / this.aedConstant;


  //     let groupData = apiData.find(api =>
  //       `${api.api_spec}${api.api_endpoint}:${api.api_operation.toUpperCase()}`
  //         .replace(/\s+/g, '') == // Remove all whitespace
  //       `${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"].toUpperCase()}`
  //         .replace(/\s+/g, '') // Remove all whitespace
  //     );


  //     let isChargeable = chargableUrls.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
  //     let islfiChargable = lfiChargableUrls.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
  //     let success = record["raw_api_log_data.tpp_response_code_group"] == "2xx" && record["raw_api_log_data.lfi_response_code_group"] == "2xx";
  //     if (record["raw_api_log_data.psu_id"] != null && isChargeable && success && (record["raw_api_log_data.url"].includes('confirmation-of-payee') || record["raw_api_log_data.url"].includes('balances'))) {
  //       const filterData = data.filter((logData: { [x: string]: string; }) => {
  //         return logData["raw_api_log_data.psu_id"] === record["raw_api_log_data.psu_id"] && !logData["raw_api_log_data.url"].includes('confirmation-of-payee') && !logData["raw_api_log_data.url"].includes('balances')
  //       })
  //       if (filterData.length > 0) {
  //         const lastRecord = filterData[0];
  //         const lastRecordTime = new Date(lastRecord["raw_api_log_data.timestamp"]);
  //         const currentRecordTime = new Date(record["raw_api_log_data.timestamp"]);
  //         const timeDiff = Math.abs(currentRecordTime.getTime() - lastRecordTime.getTime());
  //         const hours = Math.ceil(timeDiff / (1000 * 60 * 60));
  //         console.log('iam time diff', hours)
  //         if (hours <= 2) {
  //           api_hub_fee = 0.5 / this.aedConstant;
  //           discounted = true
  //         }
  //       }
  //     } else if (isChargeable && record["raw_api_log_data.url"]?.includes('insurance')) {
  //       api_hub_fee = 12.5 / this.aedConstant;
  //     }

  //     group = groupData?.key_name || "Other";
  //     if (groupData?.key_name == 'balance' || groupData?.key_name == 'confirmation') {
  //       group = "data";
  //     }
  //     return {
  //       ...record,
  //       group: group,
  //       type: groupData?.key_name == 'payment-bulk' || groupData?.key_name == 'payment-non-bulk' ? this.getType(record) : 'NA',
  //       discountType: groupData?.key_name == 'balance' || groupData?.key_name == 'confirmation' ? groupData?.key_name : null,
  //       api_category: groupData?.api_category || null,
  //       chargeable: isChargeable,
  //       lfiChargable: islfiChargable,
  //       success: success,
  //       discounted: discounted,
  //       api_hub_fee: isChargeable ? api_hub_fee : 0,
  //     };

  //   }));
  //   return updatedData;
  // }
  async determineChargeableAndSuccess(data: any[], apiData: any[]) {
    const chargableUrls = apiData
      .filter(api => api.chargeable_api_hub_fee === true)
      .map(api => `${api.api_spec}${api.api_endpoint}:${api.api_operation.toUpperCase()}`);

    const lfiChargableUrls = apiData
      .filter(api => api.chargeable_LFI_TPP_fee === true)
      .map(api => `${api.api_spec}${api.api_endpoint}:${api.api_operation.toUpperCase()}`);

    return data.map(record => {
      const isChargeable = chargableUrls.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
      const islfiChargable = lfiChargableUrls.includes(`${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"]}`);
      const success = /^2([a-zA-Z0-9]{2}|\d{2})$/.test(record["raw_api_log_data.tpp_response_code_group"]) &&
        /^2([a-zA-Z0-9]{2}|\d{2})$/.test(record["raw_api_log_data.lfi_response_code_group"]);

      return {
        ...record,
        chargeable: isChargeable,
        lfiChargable: islfiChargable,
        success,
      };
    });
  }

  async calculateApiHubFee(processedData: any[], apiData: any[], aedConstant: number) {
    return await Promise.all(processedData.map(async record => {
      let discounted = false;
      let api_hub_fee = 2.5 / aedConstant;

      const groupData = apiData.find(api =>
        `${api.api_spec}${api.api_endpoint}:${api.api_operation.toUpperCase()}`
          .replace(/\s+/g, '') ===
        `${record["raw_api_log_data.url"]}:${record["raw_api_log_data.http_method"].toUpperCase()}`
          .replace(/\s+/g, '')
      );

      let group = groupData?.key_name || "Other";

      if (groupData?.key_name === 'balance' || groupData?.key_name === 'confirmation') {
        group = "data";
      }

      if (record.chargeable && record.success &&
        (record["raw_api_log_data.url"].includes('confirmation-of-payee') || record["raw_api_log_data.url"].includes('balances'))) {
        const filterData = processedData.filter(logData =>
          logData["raw_api_log_data.psu_id"] === record["raw_api_log_data.psu_id"] && logData.chargeable &&
          logData.success &&
          !logData["raw_api_log_data.url"].includes('confirmation-of-payee') &&
          !logData["raw_api_log_data.url"].includes('balances')
        );

        if (filterData.length > 0) {
          const lastRecord = filterData[0];
          const lastRecordTime = new Date(lastRecord["raw_api_log_data.timestamp"]);
          const currentRecordTime = new Date(record["raw_api_log_data.timestamp"]);
          const timeDiff = Math.abs(currentRecordTime.getTime() - lastRecordTime.getTime());
          const hours = Math.ceil(timeDiff / (1000 * 60 * 60));

          if (hours <= 2) {
            api_hub_fee = 0.5 / aedConstant;
            discounted = true;
          }
        }
      } else if (record.chargeable && record.success && record.group === 'insurance') {
        api_hub_fee = 12.5 / aedConstant;
      }

      return {
        ...record,
        group,
        type: groupData?.key_name === 'payment-bulk' || groupData?.key_name === 'payment-non-bulk' ? this.getType(record) : 'NA',
        discountType: groupData?.key_name === 'balance' || groupData?.key_name === 'confirmation' ? groupData?.key_name : null,
        api_category: groupData?.api_category || null,
        discounted,
        api_hub_fee: record.chargeable ? api_hub_fee : 0,
      };
    }));
  }

  async chargableConvertion(data: any) {
    try {
      const apiData = await this.apiModel.find({
        $or: [
          { chargeable_api_hub_fee: true },
          { chargeable_LFI_TPP_fee: true }
        ]
      });

      const processedData = await this.determineChargeableAndSuccess(data, apiData);
      const updatedData = await this.calculateApiHubFee(processedData, apiData, this.aedConstant);

      return updatedData;
    } catch (error) {
      console.error("Error in chargableConvertion:", error);
      throw new Error("Chargeable conversion failed");
    }
  }



  getType(logEntry: any) {
    let type = "NA";
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

