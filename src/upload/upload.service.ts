import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import { Model } from 'mongoose';
import { PaginationEnum, StatusEnum } from 'src/common/constants/constants.enum';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { AppConfig } from 'src/config/app.config';
import { GlobalConfiguration, GlobalConfigurationDocument } from 'src/configuration/schema/global_config.schema';
import { file1HeadersIncludeSchema, file2HeadersIncludeSchema, lfiTppHeaderSchema, validateHeaders } from 'src/validation/csv-validation';
import { Log, LogDocument } from './schemas/billing-log.schema';
import { ApiData, ApiDataDocument } from './schemas/endpoint.schema';
import { LfiData, LfiDataDocument } from './schemas/lfi-data.schema';
import { MerchantTransaction, MerchantTransactionDocument } from './schemas/merchant.limitapplied.schema';
import { PageMultiplier, PageMultiplierDocument } from './schemas/pagemultiplier.schema';
import { TppData, TppDataDocument } from './schemas/tpp-data.schema';
import { uploadLog, uploadLogDocument } from './schemas/upload-log.schema';
const { Parser } = require('json2csv');

@Injectable()
export class UploadService {
  constructor(
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
    @InjectModel(LfiData.name) private lfiModel: Model<LfiDataDocument>,
    @InjectModel(TppData.name) private TppModel: Model<TppDataDocument>,
    @InjectModel(ApiData.name) private apiModel: Model<ApiDataDocument>,
    @InjectModel(MerchantTransaction.name) private merchantLimitModel: Model<MerchantTransactionDocument>,
    @InjectModel(PageMultiplier.name) private pageMultiplier: Model<PageMultiplierDocument>,
    @InjectModel(uploadLog.name) private uploadLog: Model<uploadLogDocument>,
    @InjectModel(GlobalConfiguration.name) private globalModel: Model<GlobalConfigurationDocument>,
  ) { }

  private readonly peer_to_peer_types = AppConfig.peerToPeerTypes;
  private readonly nonLargeValueCapMerchantCheck = AppConfig.highValueMerchantcapCheck;

  private variables: {
    nonLargeValueCapMerchant?: any; //50 aed
    nonLargeValueFreeLimitMerchant?: any; //200 aed
    bulkLargeCorporatefee?: any; // 2.5
    paymentLargeValueFee?: any; //4 aed
    paymentFeeMe2me?: any; // 0.2 aed
    bulkMe2meCap?: any; //2.5 aed
    paymentNonLargevalueFeePeer?: any; //0.25 aed
    attendedCallFreeLimit?: any; // 15 count
    unAttendedCallFreeLimit?: any; // 5 count
    nonLargeValueMerchantBps?: any; //0.0038 aed
    bulkPeernonLargeValueCap?: any; //2.5 aed
    dataLargeCorporateMdp?: any; // 0.4 aed
    paymentApiHubFee?: any; // 0.025 aed
    discountApiHubFee?: any; // 0.005 aed
    insuranceApiHubFee?: any; // 0.125 aed
    discountHourValue?: any; // 2 hour
  } = {};

  async mergeCsvFiles(userEmail: string, file1Path: string, file2Path: string, downloadCsv: boolean = false,) {
    const file1Data: any[] = [];
    const file2Data: any[] = [];
    let globalData = await this.globalModel.find();
    if (globalData.length) {
      globalData.forEach((obj) => {
        switch (obj.key) {
          case 'nonLargeValueCapMerchant':
            this.variables.nonLargeValueCapMerchant = obj;
            break;
          case 'nonLargeValueFreeLimitMerchant':
            this.variables.nonLargeValueFreeLimitMerchant = obj;
            break;
          case 'paymentLargeValueFee':
            this.variables.paymentLargeValueFee = obj;
            break;
          case 'bulkLargeCorporatefee':
            this.variables.bulkLargeCorporatefee = obj;
            break;
          case 'paymentFeeMe2me':
            this.variables.paymentFeeMe2me = obj;
            break;
          case 'bulkMe2meCap':
            this.variables.bulkMe2meCap = obj;
            break;
          case 'paymentNonLargevalueFeePeer':
            this.variables.paymentNonLargevalueFeePeer = obj;
            break;
          case 'attendedCallFreeLimit':
            this.variables.attendedCallFreeLimit = obj;
            break;
          case 'unAttendedCallFreeLimit':
            this.variables.unAttendedCallFreeLimit = obj;
            break;
          case 'nonLargeValueMerchantBps':
            this.variables.nonLargeValueMerchantBps = obj;
            break;
          case 'bulkPeernonLargeValueCap':
            this.variables.bulkPeernonLargeValueCap = obj;
            break;
          case 'dataLargeCorporateMdp':
            this.variables.dataLargeCorporateMdp = obj;
            break;
          case 'paymentApiHubFee':
            this.variables.paymentApiHubFee = obj;
            break;
          case 'discountApiHubFee':
            this.variables.discountApiHubFee = obj;
            break;
          case 'insuranceApiHubFee':
            this.variables.insuranceApiHubFee = obj;
            break;
          case 'discountHourValue':
            this.variables.discountHourValue = obj;
            break;
          default:
            console.warn(`Unknown key: ${obj.key}`);
        }
      });

    } else {
      throw new HttpException({
        message: 'Your Global Configuration is not setup completely',
        status: 400
      }, HttpStatus.BAD_REQUEST);
    }

    let logUpdate: any;
    if (!file1Path || !file2Path) {
      logUpdate = await this.uploadLog.create({
        batchNo: `${Date.now()}`,
        uploadedAt: new Date(),
        raw_log_path: file1Path,
        payment_log_path: file2Path,
        status: 'Failed',
        uploadedBy: userEmail,
        remarks: 'File UploadUpload Failed, processing Stopped',
        log: [
          !file1Path ? {
            description: "Uploading Failed for the raw data log",
            status: "Failed",
            errorDetail: "Missing file1Path for raw data log"
          } : {
            description: "Uploading Failed for the payment data log",
            status: "Failed",
            errorDetail: "Missing file1Path for payment data log"
          }
        ],
      }
      )

      throw new HttpException({
        message: !file1Path ? 'Missing raw data file' : !file2Path ? 'Missing payment data file' : 'Both files are required',
        status: 400
      }, HttpStatus.BAD_REQUEST);
    }
    else {
      logUpdate = await this.uploadLog.create({
        batchNo: `${Date.now()}`,
        uploadedAt: new Date(),
        raw_log_path: file1Path,
        payment_log_path: file2Path,
        status: 'Processing',
        uploadedBy: userEmail,
        remarks: 'File Uploaded, processing started',
        log: [
          {
            description: "Processing and filter logic started",
            status: "In Progress",
            errorDetail: null
          }
        ]
      }
      )
    }



    // Validate headers for file1
    await new Promise((resolve, reject) => {
      fs.createReadStream(file1Path)
        .pipe(csv())
        .on('headers', async (headers) => {
          const normalizedHeaders = headers.map((header) =>
            header.replace(/^\ufeff/, '').trim()
          );
          try {
            const data1Error = validateHeaders(normalizedHeaders, file1HeadersIncludeSchema);
            // console.log('iam data1Error', data1Error)
          } catch (error) {
            console.error('Validation error for raw log data headers:', error.message);
            reject(new HttpException(
              {
                message: 'Validation failed for raw API log data headers.',
                status: 400,
              },
              HttpStatus.BAD_REQUEST, // Use the appropriate status code constant
            ));
            await this.uploadLog.findByIdAndUpdate(
              logUpdate._id,
              {
                $set: {
                  status: 'Failed',
                  remarks: 'Failed to validate raw log headers',
                },
                $push: {
                  log: {
                    description: error.message,
                    status: 'Failed',
                    errorDetail: error.message,
                  },
                },
              }
            );
            reject(new HttpException(
              {
                message: 'Validation failed for raw API log data headers.',
                status: 400,
              },
              HttpStatus.BAD_REQUEST
            ));
          }
        })
        .on('data', (row) => {
          const normalizedRow: any = {};
          let isEmptyRow = true;

          for (const key in row) {
            const normalizedKey = key.replace(/^\ufeff/, '').trim();
            const value = row[key]?.trim();

            normalizedRow[normalizedKey] = value;
            if (value) isEmptyRow = false;
          }

          if (!isEmptyRow) {
            normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
            file1Data.push(normalizedRow);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Validate headers for file2
    await new Promise((resolve, reject) => {
      fs.createReadStream(file2Path)
        .pipe(csv())
        .on('headers', async (headers) => {
          const normalizedHeaders = headers.map((header) =>
            header.replace(/^\ufeff/, '').trim()
          );
          try {
            const dataError = validateHeaders(normalizedHeaders, file2HeadersIncludeSchema);
          } catch (error) {
            console.error('Validation error for payment log data headers:', error.message);
            reject(new HttpException(
              {
                message: 'Validation failed for payment API log data headers.',
                status: 400,
              },
              HttpStatus.BAD_REQUEST, // Use the appropriate status code constant
            ));
            await this.uploadLog.findByIdAndUpdate(
              logUpdate._id,
              {
                $set: {
                  status: 'Failed',
                  remarks: 'Failed to validate payment log headers',
                },
                $push: {
                  log: {
                    description: error.message,
                    status: 'Failed',
                    errorDetail: error.message,
                  },
                },
              }
            );
            reject(new HttpException(
              {
                message: 'Validation failed for payment API log data headers.',
                status: 400,
              },
              HttpStatus.BAD_REQUEST
            ));
          }
        })
        .on('data', (row) => {
          const normalizedRow: any = {};
          let isEmptyRow = true;

          for (const key in row) {
            const normalizedKey = key.replace(/^\ufeff/, '').trim();
            const value = row[key]?.trim();

            normalizedRow[normalizedKey] = value;
            if (value) isEmptyRow = false;
          }

          if (!isEmptyRow) {
            normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
            file2Data.push(normalizedRow);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });


    await this.uploadLog.findByIdAndUpdate(
      logUpdate._id,
      {
        $push: {
          log: {
            description: `Header Validation Completed For Both Raw Log csv and Payment Log csv`,
            status: 'Completed',
            errorDetail: null
          }
        }
      }
    );

    const parseBoolean = (value: string) => {
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
      }
      return null;
    };
    const mergedData: any[] = [];
    for (let i = 0; i < file1Data.length; i++) {
      const rawApiRecord = file1Data[i];
      const paymentRecord = file2Data[i] || {};
      const mergedRecord = {
        [`raw_api_log_data.timestamp`]: rawApiRecord.timestamp || null,
        [`raw_api_log_data.tpp_name`]: rawApiRecord.tppName || null,
        [`raw_api_log_data.lfi_name`]: rawApiRecord.lfiName || null,
        [`raw_api_log_data.lfi_id`]: rawApiRecord.lfiId || null,
        [`raw_api_log_data.tpp_id`]: rawApiRecord.tppId || null,
        [`raw_api_log_data.tpp_client_id`]: rawApiRecord.tppClientId || null,
        [`raw_api_log_data.api_set_sub`]: rawApiRecord.apiSet || null,
        [`raw_api_log_data.http_method`]: rawApiRecord.httpMethod || null,
        [`raw_api_log_data.url`]: rawApiRecord.url || null,
        [`raw_api_log_data.tpp_response_code_group`]: rawApiRecord.tppResponseCodeGroup || null,
        [`raw_api_log_data.execution_time`]: rawApiRecord.executionTime || null,
        [`raw_api_log_data.interaction_id`]: rawApiRecord.interactionId || null,
        [`raw_api_log_data.resource_name`]: rawApiRecord.resourceName || null,
        [`raw_api_log_data.lfi_response_code_group`]: rawApiRecord.lfIResponseCodeGroup || null,
        [`raw_api_log_data.is_attended`]: parseBoolean(rawApiRecord.isAttended),
        [`raw_api_log_data.records`]: rawApiRecord.records || null,
        [`raw_api_log_data.payment_type`]: rawApiRecord.paymentType || null,
        [`raw_api_log_data.payment_id`]: rawApiRecord.PaymentId || null,
        [`raw_api_log_data.merchant_id`]: rawApiRecord.merchantId || null,
        [`raw_api_log_data.psu_id`]: rawApiRecord.psuId || null,
        ["raw_api_log_data.is_large_corporate"]: parseBoolean(rawApiRecord.isLargeCorporate),
        [`raw_api_log_data.user_type`]: rawApiRecord.userType || null,
        [`raw_api_log_data.purpose`]: rawApiRecord.purpose || null,

        [`payment_logs.timestamp`]: paymentRecord.timestamp || null,
        [`payment_logs.tpp_name`]: paymentRecord.tppName || null,
        [`payment_logs.lfi_name`]: paymentRecord.lfiName || null,
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
        [`payment_logs.is_large_corporate`]: parseBoolean(paymentRecord.isLargeCorporate),
        [`payment_logs.number_of_successful_transactions`]: paymentRecord.numberOfSuccessfulTransactions || null,
        [`payment_logs.international_payment`]: parseBoolean(paymentRecord.internationalPayment),
      };
      mergedData.push(mergedRecord);

    }
    // return mergedData;
    const chargeFile = await this.chargableConvertion(mergedData);
    console.log('stage 1 completed');

    const feeApplied = await this.calculateFee(chargeFile);
    console.log('stage 2 completed');

    let response = await this.populateLfiData(feeApplied);
    console.log('stage 3 completed');

    let result = await this.populateTppData(feeApplied);
    console.log('stage 4 completed');


    const pagesFeeApplied = await this.feeCalculationForLfi(feeApplied);
    console.log('stage 5 completed');

    const pageDataCalculation = await this.attendedUpdateOnNumberOfPage(pagesFeeApplied);

    const totalHubFeecalculation = await this.calculateTotalApiHubFee(pageDataCalculation);

    if (downloadCsv) {
      try {
        // Define the CSV headers
        const outputPath = './output/data.csv';

        const directory = outputPath.substring(0, outputPath.lastIndexOf('/'));
        if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
        }

        // Define the CSV headers
        const fields = [
          "raw_api_log_data.timestamp",
          "raw_api_log_data.tpp_name",
          "raw_api_log_data.lfi_name",
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
          "applicableApiHubFee",
          "apiHubVolume",
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
        const csv = parser.parse(totalHubFeecalculation);

        // Write the CSV file
        fs.writeFileSync(outputPath, csv, 'utf8');
        console.log(`CSV file has been created at ${outputPath}`);
        return outputPath;
      } catch (error) {
        console.error("Error creating CSV file:", error);
      }
    } else {
      // return totalHubFeecalculation
      const billData = await this.logModel.insertMany(totalHubFeecalculation);
      if (billData.length) {
        await this.uploadLog.findByIdAndUpdate(
          logUpdate._id,
          {
            $set: {
              status: 'Completed',
              remarks: 'Database Process Completed',
            },
            $push: {
              log: {
                description: `Filtering Completed and the Latest Merged Data Updated In the Database`,
                status: 'Completed',
                errorDetail: null
              },
            },
          }
        );
      }
      return billData.length;
    }

  }

  async calculateTotalApiHubFee(data: any) {
    return data.map((record: any) => {
      let totalApiHubFee = record.api_hub_fee ?? 0;
      let apiHubVolume = 1;
      if (record.group === "payment-bulk" && record.success && record.chargeable) {
        apiHubVolume = parseInt(record['payment_logs.number_of_successful_transactions'] ?? 1);
        totalApiHubFee *= apiHubVolume;
      } else if (record.group === "data" && record.success && record.chargeable) {
        if (!record.lfiChargable) {
          const records = parseInt(record["raw_api_log_data.records"] ?? "0", 10);
          record.numberOfPages = Math.ceil(records / 100) || 1;
          apiHubVolume = record.numberOfPages;
          totalApiHubFee *= apiHubVolume;
        } else {
          // Use volume when lfiChargable is true
          apiHubVolume = record.volume ?? 1;
          totalApiHubFee *= apiHubVolume;

        }
      }
      return {
        ...record,
        applicableApiHubFee: totalApiHubFee,
        apiHubVolume: apiHubVolume
      };
    });
  }
  async attendedUpdateOnNumberOfPage(data: any) {
    let lfiPageDataArray: any[] = [];
    const updatedData = data.map((record: any) => {
      if (record.lfiResult && record.lfiResult.length > 0) {
        const outerData = record.lfiResult.find(txn => txn.paymentId == record['payment_logs.payment_id']);
        if (!outerData) return record;
        record.calculatedFee = outerData?.charge;
        record.applicableFee = record.calculatedFee
        lfiPageDataArray.push(record?.lfiResult, record?.summary)
        delete record.lfiResult;
        delete record.summary;
        return {
          ...record,
          appliedLimit: outerData.appliedLimit,
          volume: outerData.chargeableAmount,
          limitApplied: outerData.appliedLimit > 0,
          unit_price: record['raw_api_log_data.is_large_corporate'] ? this.variables.dataLargeCorporateMdp.value : outerData.mdp_rate,
        };
      }

      return record;
    });

    const uniqueLfiPageData = await this.processData(lfiPageDataArray);
    if (!uniqueLfiPageData.summary.psuId !== null && !uniqueLfiPageData.summary.date! == null) {
      const existingMulti = await this.pageMultiplier.findOne({
        "summary.psuId": uniqueLfiPageData.summary.psuId,
        'summary.date': uniqueLfiPageData.summary.date
      });
      if (!existingMulti) {
        const lfiPageData = await this.pageMultiplier.insertMany(uniqueLfiPageData);
      }
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

  async populateLfiData(rawData: any[]) {
    const uniqueLfiIds = Array.from(new Set(rawData.map(data => data["raw_api_log_data.lfi_id"])));

    const lfiDataToInsert = uniqueLfiIds.map(lfi_id => ({
      lfi_id,
      lfi_name: rawData.find(data => data["raw_api_log_data.lfi_id"] === lfi_id)["raw_api_log_data.lfi_name"],
      mdp_rate: parseFloat((Math.random() * (3 - 2) + 2).toFixed(2)),
      free_limit_attended: this.variables.attendedCallFreeLimit.value,
      free_limit_unattended: this.variables.unAttendedCallFreeLimit.value,
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
    try {
      // Use a Map to ensure uniqueness while extracting relevant fields
      const tppMap = new Map();

      rawData.forEach(data => {
        const tpp_id = data["raw_api_log_data.tpp_id"];
        const tpp_name = data["raw_api_log_data.tpp_name"];

        if (tpp_id && !tppMap.has(tpp_id)) {
          tppMap.set(tpp_id, { tpp_id, tpp_name });
        }
      });

      // Prepare data for insertion
      const tppDataToInsert = Array.from(tppMap.values());

      // Insert or update TPP data
      for (const tppData of tppDataToInsert) {
        try {
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
    } catch (error) {
      console.error("Error during TPP data processing:", error.message);
      throw new Error("Failed to populate TPP data.");
    }
  }


  async feeCalculationForLfi(data: any) {
    try {
      const psuGroupedMap: Record<
        string,
        { psuId: string; date: string; isAttended: string; totalPages: number; tpp_id: string; transactions: any[] }
      > = {};

      data.forEach((transaction) => {
        if (transaction.lfiChargable && transaction.success && transaction.group === "data" && transaction.type === "NA") {
          const psuId = transaction["raw_api_log_data.psu_id"];
          const timestamp = transaction["raw_api_log_data.timestamp"];
          const numberOfPages = transaction.numberOfPages;
          const isAttended = transaction["raw_api_log_data.is_attended"];
          const tpp_id = transaction["raw_api_log_data.tpp_id"];

          if (!psuId || !timestamp || !numberOfPages || isAttended === undefined) return;

          const date = new Date(timestamp).toISOString().split("T")[0];
          const key = `${psuId}_${date}_${isAttended}_${tpp_id}`;

          // console.log('iam key', key)

          if (!psuGroupedMap[key]) {
            psuGroupedMap[key] = {
              psuId,
              date,
              isAttended,
              tpp_id,
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
            const tpp_id = record["raw_api_log_data.tpp_id"];
            const key = `${psuId}_${date}_${isAttended}_${tpp_id}`;

            console.log('iam key', key)
            console.log('iam bool data', isAttended)
            console.log('iam tpp data', tpp_id)

            const margin =
              isAttended == true
                ? lfiData.free_limit_attended
                : isAttended == false
                  ? lfiData.free_limit_unattended
                  : 0;
            const lfiMdpMultiplier = record['raw_api_log_data.is_large_corporate'] ? this.variables.dataLargeCorporateMdp.value : lfiData.mdp_rate;

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
              // remainingBalance: this.discount,
              remainingBalance: this.variables.nonLargeValueFreeLimitMerchant.value,
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
        let volume = 0;
        let calculatedFee = 0;
        let applicableFee = 0;
        let numberOfPages = 0;
        let result: any[] = [];
        let unit_price = 0;
        let appliedLimit = 0;
        let limitApplied = false;
        let isCapped: boolean = false;
        let cappedAt = 0;
        if (record.lfiChargable && record.success) {

          if (record.group === "payment-bulk" && Boolean(record['raw_api_log_data.is_large_corporate'])) {

            return {
              ...record,
              calculatedFee: parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"]) * this.variables.bulkLargeCorporatefee.value).toFixed(3)),
              applicableFee: parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"]) * this.variables.bulkLargeCorporatefee.value).toFixed(3)), // Ensure 
              type: "corporate",
              unit_price: this.variables.bulkLargeCorporatefee.value,
              volume: parseInt(record["payment_logs.number_of_successful_transactions"] ?? 0),
              isCapped: false,
              cappedAt: 0,
            }
          }

          // MERCHANT CALCULATION
          if (record.type === "merchant") {

            if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
              if (record.group == 'payment-non-bulk') {
                calculatedFee = this.variables.paymentLargeValueFee.value
                applicableFee = calculatedFee
                unit_price = this.variables.paymentLargeValueFee.value;
                volume = 1;
              } else if (record.group == 'payment-bulk') {
                calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"]) * this.variables.paymentLargeValueFee.value).toFixed(3));
                applicableFee = calculatedFee
                unit_price = this.variables.paymentLargeValueFee.value;
                volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 0);
              }


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
                  calculatedFee = parseFloat((filteredTransaction.chargeableAmount * (this.variables.nonLargeValueMerchantBps.value / 10000)).toFixed(3));
                  applicableFee = parseFloat((parseInt(record["payment_logs.amount"]) > this.nonLargeValueCapMerchantCheck ? this.variables.nonLargeValueCapMerchant.value : calculatedFee).toFixed(3));
                  unit_price = (this.variables.nonLargeValueMerchantBps.value / 10000);
                  volume = filteredTransaction.chargeableAmount ?? 0;
                  appliedLimit = filteredTransaction.appliedLimit;
                  limitApplied = filteredTransaction.appliedLimit > 0;
                  isCapped = parseInt(record["payment_logs.amount"]) > this.nonLargeValueCapMerchantCheck; // Assign boolean value
                  cappedAt = isCapped ? this.variables.nonLargeValueCapMerchant.value : 0;

                }
              }
            }

          }

          // PEER-2-PEER
          else if (record.type === 'peer-2-peer') {
            if (record.group === 'payment-bulk') {
              if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
                calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"]) * this.variables.paymentLargeValueFee.value).toFixed(3));
                applicableFee = calculatedFee
                unit_price = this.variables.paymentLargeValueFee.value;
                volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 0);

              } else {
                calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"]) * this.variables.paymentNonLargevalueFeePeer.value).toFixed(3));

                applicableFee = parseFloat((calculatedFee > this.variables.bulkPeernonLargeValueCap.value ? this.variables.bulkPeernonLargeValueCap.value : calculatedFee).toFixed(3));
                unit_price = this.variables.paymentNonLargevalueFeePeer.value;
                volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 0);
                isCapped = calculatedFee > this.variables.bulkPeernonLargeValueCap.value ? true : false // Assign boolean value
                cappedAt = isCapped ? this.variables.bulkPeernonLargeValueCap.value : 0;
              }
            }
            else if (record.group === 'payment-non-bulk') {
              if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
                calculatedFee = parseFloat((this.variables.paymentLargeValueFee.value).toFixed(3));
                applicableFee = calculatedFee
                unit_price = this.variables.paymentLargeValueFee.value;
                volume = 1;

              } else {
                calculatedFee = parseFloat(this.variables.paymentNonLargevalueFeePeer.value.toFixed(3));

                applicableFee = calculatedFee;
                unit_price = this.variables.paymentNonLargevalueFeePeer.value;
                volume = 1;
              }
            }

          }

          // ME-2-ME
          else if (record.type === 'me-2-me') {
            if (record.group === 'payment-bulk') {
              calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 0) * this.variables.paymentFeeMe2me.value).toFixed(3));
              applicableFee = parseFloat((calculatedFee > this.variables.bulkMe2meCap.value ? this.variables.bulkMe2meCap.value : calculatedFee).toFixed(3));
              unit_price = this.variables.paymentFeeMe2me.value;
              volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 0);
              isCapped = calculatedFee > this.variables.bulkMe2meCap.value ? true : false
              cappedAt = isCapped ? this.variables.bulkMe2meCap.value : 0;
            }
            else if (record.group === 'payment-non-bulk') {
              calculatedFee = parseFloat((this.variables.paymentFeeMe2me.value).toFixed(3));
              applicableFee = calculatedFee;
              unit_price = this.variables.paymentFeeMe2me.value;
              volume = 1;
            }
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
          volume,
          appliedLimit,
          limitApplied,
          isCapped,
          cappedAt,
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


  async determineChargeableAndSuccess(data: any[], apiData: any[]) {
    // Convert API data into lists of chargeable URLs with their methods
    const chargableUrls = apiData
      .filter(api => api.chargeable_api_hub_fee === true)
      .map(api => ({ endpoint: api.api_endpoint, method: api.api_operation.toUpperCase() }));

    const lfiChargableUrls = apiData
      .filter(api => api.chargeable_LFI_TPP_fee === true)
      .map(api => ({ endpoint: api.api_endpoint, method: api.api_operation.toUpperCase() }));

    console.log('iam chargeable urls', chargableUrls)
    console.log('iam lfi chargeable urls', lfiChargableUrls)

    return await Promise.all(data.map(async record => {
      const rawDataEndpoint = await this.matchTemplateVersionUrl(record["raw_api_log_data.url"]);
      const rawDataMethod = record["raw_api_log_data.http_method"];
      console.log(rawDataMethod, ':', rawDataEndpoint, 'rawDataMethod')


      // Match the raw URL and method against chargeable API data
      const isChargeable = await Promise.all(
        chargableUrls.map(async (api) => {
          const urlMatch = await this.matchTemplateUrl(api.endpoint, rawDataEndpoint);
          const methodMatch = api.method.toUpperCase() === rawDataMethod.toUpperCase();
          return urlMatch && methodMatch;
        })
      ).then((results) => results.some((result) => result)); // If any result is true, isChargeable is true

      const islfiChargable = await Promise.all(
        lfiChargableUrls.map(async (api) => {
          const urlMatch = await this.matchTemplateUrl(api.endpoint, rawDataEndpoint);
          const methodMatch = api.method.toUpperCase() === rawDataMethod.toUpperCase();
          return urlMatch && methodMatch;
        })
      ).then((results) => results.some((result) => result));
      // Determine if the record is successful based on response codes
      const success = /^2([a-zA-Z0-9]{2}|\d{2})$/.test(record["raw_api_log_data.tpp_response_code_group"]) &&
        /^2([a-zA-Z0-9]{2}|\d{2})$/.test(record["raw_api_log_data.lfi_response_code_group"]);

      return {
        ...record,
        chargeable: isChargeable,
        lfiChargable: islfiChargable,
        success,
      };
    }));
  }

  async calculateApiHubFee(processedData: any[], apiData: any[],) {
    return await Promise.all(processedData.map(async record => {

      let discounted = false;
      let api_hub_fee = this.variables.paymentApiHubFee.value;


      const groupData = await this.findGroupData(record, apiData);
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

          if (hours <= this.variables.discountHourValue.value) {
            api_hub_fee = this.variables.discountApiHubFee.value;
            discounted = true;
          }
        }
      } else if (record.chargeable && record.success && group === 'insurance') {
        api_hub_fee = this.variables.insuranceApiHubFee.value;
      } else if (!record.chargeable || !record.success) {
        api_hub_fee = 0;
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

  private async findGroupData(record: any, apiData: any[]): Promise<any> {
    console.log('---------------------------------------------------------------------')
    const endPointurl = await this.matchTemplateVersionUrl(record["raw_api_log_data.url"]);
    const httpMethod = record["raw_api_log_data.http_method"]

    for (const api of apiData) {
      const isUrlMatch = await this.matchTemplateUrl(api.api_endpoint, endPointurl);
      if (isUrlMatch && api.api_operation.toUpperCase() === httpMethod.toUpperCase()) {
        return api; // Return the first matching object
      }
    }

    return null; // Return null if no match is found
  }

  async chargableConvertion(data: any) {
    try {
      // console.log(globalData)
      const apiData = await this.apiModel.find({
        $or: [
          { chargeable_api_hub_fee: true },
          { chargeable_LFI_TPP_fee: true }
        ]
      });

      const processedData = await this.determineChargeableAndSuccess(data, apiData);
      const updatedData = await this.calculateApiHubFee(processedData, apiData,);

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
  async matchTemplateVersionUrl(url: string): Promise<string> {
    try {
      const versionRegex = /\/v\d+\.\d+/;

      const parts = url.split(versionRegex);
      return parts[1] || ''; // Return the remaining path after the version
    } catch (error) {
      console.error('Error:', error);
      return ''; // Return an empty string in case of an error
    }
  }

  async matchTemplateUrl(templateUrl: string, realUrl: string) {
    // Convert the template URL to a regular expression
    const regexString = templateUrl.replace(/{[^}]+}/g, '[^/]+');
    const regex = new RegExp(`^${regexString}$`);

    console.log('iam regex', regex.test(realUrl))
    return regex.test(realUrl);
  }

  async getRawLogCsv(batchId: string) {
    try {
      const logData = await this.uploadLog.findOne({ _id: batchId });
      if (!logData) {
        throw new HttpException('Batch ID not found', HttpStatus.NOT_FOUND);
      }
      const filePath = logData.raw_log_path;
      return filePath;
    } catch (error) {
      console.error("Error in getRawLogCsv:", error);
      throw new Error("Failed to retrieve raw log CSV");

    }
  }

  async getPaymentLogCsv(batchId: string) {
    try {
      const logData = await this.uploadLog.findOne({ _id: batchId });
      if (!logData) {
        throw new HttpException('Batch ID not found', HttpStatus.NOT_FOUND);
      }
      const filePath = logData.payment_log_path;
      return filePath;
    } catch (error) {
      console.error("Error in getPaymentLogCsv:", error);
      throw new Error("Failed to retrieve payment log CSV");

    }
  }

  async getUploadLogData(paginationDTO: PaginationDTO) {
    try {
      const offset = paginationDTO.offset
        ? Number(paginationDTO.offset)
        : PaginationEnum.OFFSET;
      const limit = paginationDTO.limit
        ? Number(paginationDTO.limit)
        : PaginationEnum.LIMIT;
      const options: any = {};
      const status =
        paginationDTO.status && paginationDTO.status !== 'all'
          ? paginationDTO.status
          : null;

      if (status && !Object.values(StatusEnum).includes(status as StatusEnum)) {
        throw new Error(`Invalid status value. Allowed values are: ${Object.values(StatusEnum).join(', ')}`);
      }
      // console.log('iam status', status)
      // console.log('iam options', options)
      Object.assign(options, {
        ...(status === null ? { status: { $ne: null } } : { status: status }),
      });
      const search = paginationDTO.search ? paginationDTO.search.trim() : null;
      if (search) {
        const searchRegex = new RegExp(search, "i");
        options.$or = [{ "batchNo": search }, { "uploadedBy": searchRegex }];
      }
      const total = await this.uploadLog.countDocuments(options).exec();
      const uploadlogData = await this.uploadLog.find(options).skip(offset).limit(limit).sort({ createdAt: -1 }).lean<any>()
      // return uploadlogData;
      return {
        uploadlogData,
        pagination: {
          offset: offset,
          limit: limit,
          total: total
        }
      }
    } catch (error) {
      console.error("Error in upload log getting:", error);
      throw new Error("Failed to retrieve upload log data");

    }
  }

  async updateTppAndLfi(organizationPath: string,) {
    try {
      const organizationData: any[] = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(organizationPath)
          .pipe(csv())
          .on('headers', async (headers) => {
            const normalizedHeaders = headers.map((header) =>
              header.replace(/^\ufeff/, '').trim()
            );
            try {
              const data1Error = validateHeaders(normalizedHeaders, lfiTppHeaderSchema);
              // console.log('iam data1Error', data1Error)
            } catch (error) {
              console.error('Validation failed for Organization data headers:', error.message);
              reject(new HttpException(
                {
                  message: error.message,
                  status: 400,
                },
                HttpStatus.BAD_REQUEST, // Use the appropriate status code constant
              ));
            }
          })
          .on('data', (row) => {
            const normalizedRow: any = {};
            let isEmptyRow = true;

            for (const key in row) {
              const normalizedKey = key.replace(/^\ufeff/, '').trim();
              const value = row[key]?.trim();

              normalizedRow[normalizedKey] = value;
              if (value) isEmptyRow = false;
            }

            if (!isEmptyRow) {
              organizationData.push(normalizedRow);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });
      console.log('iam organizationData', organizationData)

      const lfiData = organizationData.filter(record => record.Size === 'LFI' && record['Org Status'] === 'Active' && record.ContactType === 'Business');
      const tppData = organizationData.filter(record => record.Size === 'TPP' && record['Org Status'] === 'Active' && record.ContactType === 'Business');

      if (lfiData.length > 0) {
        await this.bulkCreateOrUpdateLFI(lfiData);
      }
      if (tppData.length > 0) {
        await this.bulkCreateOrUpdateTPP(tppData);
      }
      return {
        lfiData: lfiData.length,
        tppData: tppData.length,
      };
    } catch (error) {
      console.error('Error reading organization data:', error);
      throw new HttpException(
        {
          message: error.message || 'Failed to read organization data.',
          status: 500,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async bulkCreateOrUpdateLFI(records: any[]) {
    let globalData = await this.globalModel.find({ key: { $in: ['attendedCallFreeLimit', 'unAttendedCallFreeLimit'] } });
    let attendedCallFreeLimit = globalData.find(item => item.key === 'attendedCallFreeLimit')?.value;
    let unAttendedCallFreeLimit = globalData.find(item => item.key === 'unAttendedCallFreeLimit')?.value;
    const lfiIds = records.map(record => record.OrganisationId);
    await this.lfiModel.updateMany(
      { lfi_id: { $in: lfiIds } },
      { $set: { email_address: [] } }
    );
    const bulkOps = records.map(record => {
      const update: any = {
        $set: {
          lfi_name: record.OrganisationName,
          free_limit_attended: attendedCallFreeLimit,
          free_limit_unattended: unAttendedCallFreeLimit,
          registered_name: record.RegisteredName,
          addressLine_2: record.AddressLine2,
          country: record.Country,
          post_code: record.Postcode,
          org_status: record['Org Status'],
          contact_type: record.ContactType,
          first_name: record.FirstName,
          last_name: record.LastName,
        },
      };

      // Conditionally add email_address if UserStatus is active
      if (record['User Status'] === 'Active') {
        update.$addToSet = { email_address: record.EmailAddress };
      }

      return {
        updateOne: {
          filter: { lfi_id: record.OrganisationId },
          update,
          upsert: true, // Create if not exists
        },
      };
    });

    // Execute the bulkWrite
    await this.lfiModel.bulkWrite(bulkOps);
  }


  async bulkCreateOrUpdateTPP(records: any[]) {
    const tppIds = records.map(record => record.OrganisationId);
    await this.TppModel.updateMany(
      { tpp_id: { $in: tppIds } },
      { $set: { email_address: [] } }
    );

    // const bulkOps = records.map(record => ({
    //   updateOne: {
    //     filter: { tpp_id: record.OrganisationId },
    //     update: {
    //       $set: {
    //         tpp_name: record.OrganisationName,
    //         registered_name: record.RegisteredName,
    //         addressLine_2: record.AddressLine2,
    //         country: record.Country,
    //         post_code: record.Postcode,
    //         org_status: record['Org Status'],
    //         contact_type: record.ContactType,
    //         first_name: record.FirstName,
    //         last_name: record.LastName,
    //       },
    //       $addToSet: { email_address: record.EmailAddress },
    //     },
    //     upsert: true, // Create if not exists
    //   },
    // }));
    const bulkOps = records.map(record => {
      const update: any = {
        $set: {
          tpp_name: record.OrganisationName,
          registered_name: record.RegisteredName,
          addressLine_2: record.AddressLine2,
          country: record.Country,
          post_code: record.Postcode,
          org_status: record['Org Status'],
          contact_type: record.ContactType,
          first_name: record.FirstName,
          last_name: record.LastName,
        },
      };

      // Conditionally add email_address if UserStatus is active
      if (record['User Status'] === 'Active') {
        update.$addToSet = { email_address: record.EmailAddress };
      }

      return {
        updateOne: {
          filter: { tpp_id: record.OrganisationId },
          update,
          upsert: true, // Create if not exists
        },
      };
    });

    await this.TppModel.bulkWrite(bulkOps);
  }
}

