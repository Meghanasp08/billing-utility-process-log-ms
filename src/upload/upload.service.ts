import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as moment from 'moment';
import { Model } from 'mongoose';
import { BrokerageConfiguration, BrokerageConfigurationDocument } from 'src/brokerage_config/schema/brokerage_config.schema';
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
import { TempRawLog } from './schemas/temp-log.schema';
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
    @InjectModel(BrokerageConfiguration.name) private brokerageConfigModel: Model<BrokerageConfigurationDocument>,
    @InjectModel(TempRawLog.name) private readonly tempLogModel: Model<any>,
  ) { }

  private readonly peer_to_peer_types = AppConfig.peerToPeerTypes;
  private readonly paymentTypesForMerchant = AppConfig.paymentTypesForMerchant;
  private readonly nonLargeValueCapMerchantCheck = AppConfig.highValueMerchantcapCheck;
  private readonly paymentTypes = AppConfig.paymentTypes;
  private readonly paymentStatus = AppConfig.paymentStatus;
  private readonly salaryBand = AppConfig.salaryBand;

  private variables: {
    nonLargeValueCapMerchant?: any; //50 aed
    nonLargeValueFreeLimitMerchant?: any; //200 aed
    bulkLargeCorporatefee?: any; // 2.5
    paymentLargeValueFee?: any; //4 aed
    paymentFeeMe2me?: any; // 0.2 aed
    bulkMe2mePeer2PeerCap?: any; //2.5 aed
    paymentNonLargevalueFeePeer?: any; //0.25 aed
    attendedCallFreeLimit?: any; // 15 count
    unAttendedCallFreeLimit?: any; // 5 count
    nonLargeValueMerchantBps?: any; //0.0038 aed
    // bulkPeernonLargeValueCap?: any; //2.5 aed
    dataLargeCorporateMdp?: any; // 0.4 aed
    paymentApiHubFee?: any; // 0.025 aed
    discountApiHubFee?: any; // 0.005 aed
    insuranceQuoteApiHubFee?: any; // 0.125 aed
    insuranceDataApiHubFee?: any; // 0.025 aed
    discountHourValue?: any; // 2 hour
    fxQuoteApiHubFee?: any; // 0.2 aed
    fxQuotelfiFee?: any; // 0.5 aed
    defaultMotorValue?: any; // 5%
    defaultTravelValue?: any; // 15%
    defaultHomeValue?: any; // 5%
    defaultEmployment_ILOValue?: any; // 0%
    defaultRenterValue?: any; // 15%
    defaultHealthValue?: any; // 5%
    defaultLifeValue?: any; // 10%
    below4000BandValue?: any; // 5%
  } = {};



  async mergeCsvFiles(userEmail: string, file1Path: string, file2Path: string, downloadCsv: boolean = false,) {
    const file1Data: any[] = [];
    const file2Data: any[] = [];
    let globalData = await this.globalModel.find();
    if (!globalData.length) {
      throw new HttpException({
        message: 'Your Global Configuration is not setup completely',
        status: 400
      }, HttpStatus.BAD_REQUEST);
    }

    globalData.forEach(obj => { this.variables[obj.key] = obj; });


    let logUpdate: any;
    if (!file1Path) {
      logUpdate = await this.uploadLog.create({
        batchNo: `${Date.now()}`,
        uploadedAt: new Date(),
        raw_log_path: file1Path,
        payment_log_path: file2Path,
        key: 'inputFiles',
        status: 'Failed',
        uploadedBy: userEmail,
        remarks: 'File UploadUpload Failed, processing Stopped',
        log: [{
          description: "Uploading Failed for the raw data log",
          status: "Failed",
          errorDetail: "Missing file1Path for raw data log"
        }
        ],
      }
      )

      throw new HttpException({
        message: 'Missing raw data file',
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
        key: 'inputFiles',
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
            // normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
            file1Data.push(normalizedRow);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Validate headers for file2
    if (file2Path !== "") {
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
              // normalizedRow['PaymentId'] = normalizedRow['PaymentId'] || normalizedRow['Payment Id'];
              file2Data.push(normalizedRow);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });
    }


    await this.uploadLog.findByIdAndUpdate(
      logUpdate._id,
      {
        $push: {
          log: {
            description: file2Path !== "" ? `Header Validation Completed For Both Raw Log csv and Payment Log csv` : `Header Validation Completed For Raw Log csv`,
            status: 'Completed',
            errorDetail: null
          }
        }
      }
    );

    const parseBoolean = async (value: string, index: number, field: string, rawData: boolean) => {

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
        if (normalized === '') return null;
      }
      await this.uploadLog.findByIdAndUpdate(
        logUpdate._id,
        {
          $set: {
            status: 'Failed',
            remarks: `Failed to validate ${rawData ? 'Raw Log File' : 'Payment Log File'}`,
          },
          $push: {
            log: {
              description: rawData ? `Validation error occured in the ${index + 2} row for the field ${field} in Raw Log File , value is not boolean, value: ${value}` : `Validation error occured in the Payment Log file Payment ID: ${index} for the field ${field} value is not boolean, value: ${value}`,
              status: 'Failed',
              errorDetail: null,
            },
          },
        }
      );
      throw new HttpException({
        message: rawData ? `Validation error occured in the ${index + 2} row for the field ${field} in Raw Log File, value is not boolean, value: ${value}` : `Validation error occured in the Payment Log file Payment ID: ${index} for the field ${field} value is not boolean, value: ${value}`,
        status: 400
      }, HttpStatus.BAD_REQUEST);

    };

    const paymentDataMap = new Map<string, any>();
    // file2Data.forEach(async (paymentRecord, index) => {
    for (const [index, paymentRecord] of file2Data.entries()) {
      let errorPayType = !this.paymentTypes.includes(paymentRecord.paymentType)
      if (errorPayType) {
        await this.uploadLog.findByIdAndUpdate(
          logUpdate._id,
          {
            $set: {
              status: 'Failed',
              remarks: `Failed to validate 'Payment Log File`,
            },
            $push: {
              log: {
                description: `Validation error occurred in row ${index + 2} for the field 'paymentType' in the 'Payment Log File': the value does not match any of ${this.paymentTypes}. Invalid value: '${paymentRecord.paymentType}'`,
                status: 'Failed',
                errorDetail: null,
              },
            },
          }
        );
        throw new HttpException({
          message: `Payment Type is not valid in the ${index + 2} th row, please check the payment log file`,
          status: 400
        }, HttpStatus.BAD_REQUEST);
      }
      let errorAmount = paymentRecord.amount !== "" && isNaN(parseFloat(paymentRecord.amount));
      if (errorAmount) {
        await this.uploadLog.findByIdAndUpdate(
          logUpdate._id,
          {
            $set: {
              status: 'Failed',
              remarks: `Failed to validate 'Payment Log File`,
            },
            $push: {
              log: {
                description: `Validation error occurred in row ${index + 2} for the field 'amount' in the 'Payment Log File': the value should be a number. Invalid value: '${paymentRecord.amount}'`,
                status: 'Failed',
                errorDetail: null,
              },
            },
          }
        );
        throw new HttpException({
          message: `Validation error occurred in row ${index + 2} for the field 'amount' in the 'Payment Log File': the value should be a number. Invalid value: '${paymentRecord.amount}'`,
          status: 400
        }, HttpStatus.BAD_REQUEST);
      }
      let errorTrn = paymentRecord.numberOfSuccessfulTransactions !== "" && isNaN(parseFloat(paymentRecord.numberOfSuccessfulTransactions));
      if (errorTrn) {
        await this.uploadLog.findByIdAndUpdate(
          logUpdate._id,
          {
            $set: {
              status: 'Failed',
              remarks: `Failed to validate 'Raw Log File`,
            },
            $push: {
              log: {
                description: `Validation error occurred in row ${index + 2} for the field 'numberOfSuccessfulTransactions' in the 'Raw Log File': the value should be a number. Invalid value: '${paymentRecord.numberOfSuccessfulTransactions}'`,
                status: 'Failed',
                errorDetail: null,
              },
            },
          }
        );
        throw new HttpException({
          message: `Validation error occurred in row ${index + 2} for the field 'numberOfSuccessfulTransactions' in the 'Raw Log File': the value should be a number. Invalid value: '${paymentRecord.numberOfSuccessfulTransactions}'`,
          status: 400
        }, HttpStatus.BAD_REQUEST);
      }
      const paymentId = paymentRecord.paymentId?.trim();
      if (paymentId) {
        paymentDataMap.set(paymentId, paymentRecord);
      }
    };

    const mergedData = await Promise.all(
      file1Data.map(async (rawApiRecord, index) => {
        let errorPremiumAmount = rawApiRecord.PremiumAmountExcludingVAT !== "" && isNaN(parseFloat(rawApiRecord.PremiumAmountExcludingVAT));
        // if (errorPremiumAmount) {
        //   await this.uploadLog.findByIdAndUpdate(
        //     logUpdate._id,
        //     {
        //       $set: {
        //         status: 'Failed',
        //         remarks: `Failed to validate 'Raw Log File`,
        //       },
        //       $push: {
        //         log: {
        //           description: `Validation error occurred in row ${index + 2} for the field 'PremiumAmountExcludingVAT' in the 'Raw Log File': the value should be a number. Invalid value: '${rawApiRecord.PremiumAmountExcludingVAT}'`,
        //           status: 'Failed',
        //           errorDetail: null,
        //         },
        //       },
        //     }
        //   );
        //   throw new HttpException({
        //     message: `Validation error occurred in row ${index + 2} for the field 'PremiumAmountExcludingVAT' in the 'Raw Log File': the value should be a number. Invalid value: '${rawApiRecord.PremiumAmountExcludingVAT}'`,
        //     status: 400
        //   }, HttpStatus.BAD_REQUEST);
        // }
        const paymentId = rawApiRecord.paymentId?.trim();
        let paymentRecord: any = null;
        if (paymentId) {
          paymentRecord = paymentDataMap.get(paymentId);
          if (!paymentRecord) {
            await this.uploadLog.findByIdAndUpdate(
              logUpdate._id,
              {
                $set: {
                  status: 'Failed',
                  remarks: `Failed to validate 'Raw Log File`,
                },
                $push: {
                  log: {
                    description: `Validation Error: No matching record found in Payment Log file for paymentId '${paymentId}' at row ${index + 2}.`,
                    status: 'Failed',
                    errorDetail: null,
                  },
                },
              }
            );
            throw new Error(
              `Validation Error: No matching record found in Payment Log file for paymentId '${paymentId}' at row ${index + 2}.`
            );
          }
        }
        // const paymentRecord = paymentId ? paymentDataMap.get(paymentId) : null;

        return {
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
          [`raw_api_log_data.is_attended`]: await parseBoolean(rawApiRecord.isAttended, index, 'isAttended', true),
          [`raw_api_log_data.records`]: rawApiRecord.records || null,
          [`raw_api_log_data.payment_type`]: rawApiRecord.paymentType || null,
          [`raw_api_log_data.payment_id`]: rawApiRecord.paymentId || null,
          [`raw_api_log_data.merchant_id`]: rawApiRecord.merchantId || null,
          [`raw_api_log_data.psu_id`]: rawApiRecord.psuId || null,
          ["raw_api_log_data.is_large_corporate"]: await parseBoolean(rawApiRecord.isLargeCorporate, index, 'isLargeCorporate', true),
          [`raw_api_log_data.user_type`]: rawApiRecord.userType || null,
          [`raw_api_log_data.purpose`]: rawApiRecord.purpose || null,
          [`raw_api_log_data.PremiumAmountExcludingVAT`]: rawApiRecord.PremiumAmountExcludingVAT || null,
          [`raw_api_log_data.SalaryBand`]: rawApiRecord.SalaryBand || null,

          [`payment_logs.timestamp`]: paymentRecord?.timestamp || null,
          [`payment_logs.tpp_name`]: paymentRecord?.tppName || null,
          [`payment_logs.lfi_name`]: paymentRecord?.lfiName || null,
          [`payment_logs.lfi_id`]: paymentRecord?.lfiId || null,
          [`payment_logs.tpp_id`]: paymentRecord?.tppId || '',
          [`payment_logs.tpp_client_id`]: paymentRecord?.tppClientId || null,
          [`payment_logs.status`]: paymentRecord?.status || null,
          [`payment_logs.currency`]: paymentRecord?.currency || null,
          [`payment_logs.amount`]: paymentRecord?.amount || null,
          [`payment_logs.payment_consent_type`]: paymentRecord?.paymentConsentType || null,
          [`payment_logs.payment_type`]: paymentRecord?.paymentType || null,
          [`payment_logs.transaction_id`]: paymentRecord?.transactionId || null,
          [`payment_logs.payment_id`]: paymentId || null,
          [`payment_logs.merchant_id`]: paymentRecord?.merchantId || null,
          [`payment_logs.psu_id`]: paymentRecord?.psuId || null,
          [`payment_logs.is_large_corporate`]: await parseBoolean(paymentRecord?.isLargeCorporate || '', paymentRecord?.paymentId, 'isLargeCorporate', false),
          [`payment_logs.number_of_successful_transactions`]: paymentRecord?.numberOfSuccessfulTransactions || null,
          [`payment_logs.international_payment`]: paymentRecord?.internationalPayment == 'TRUE' ? true : false,
        };
      })
    ).catch(async error => {
      // Handle the error, e.g., update logs
      await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
        $set: { status: 'Failed', remarks: 'Validation failed during processing' },
        $push: {
          log: {
            description: error.message,
            status: 'Failed',
            errorDetail: error.stack,
          },
        },
      });
      throw error; // Re-throw to propagate the failure
    });

    // return mergedData;

    const chargeFile = await this.chargableConvertion(mergedData, logUpdate._id);
    console.log('stage 1 completed');

    const feeApplied = await this.calculateFee(chargeFile);
    console.log('stage 2 completed');

    let response = await this.populateLfiData(feeApplied);
    console.log('stage 3 completed');

    let result = await this.populateTppData(feeApplied);
    console.log('stage 4 completed');


    const pagesFeeApplied = await this.feeCalculationForLfi(feeApplied, logUpdate._id);
    console.log('stage 5 completed');

    const pageDataCalculation = await this.attendedUpdateOnNumberOfPage(pagesFeeApplied);

    const totalHubFeecalculation = await this.calculateTotalApiHubFee(pageDataCalculation);

    console.log("Stages Completed Successfully ");



    const existingInteractionIds = await this.logModel.distinct("raw_api_log_data.interaction_id");

    const processedRecords = totalHubFeecalculation.map((record) => {
      const isDuplicate = existingInteractionIds.includes(record["raw_api_log_data.interaction_id"]);
      return {
        ...record,
        duplicate: isDuplicate,
      };
    });
    if (processedRecords.length) {
      const billData = await this.logModel.insertMany(processedRecords);
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
    }
    return processedRecords.length


  }


  async mergeCsvFilesRefactor(userEmail: string, file1Path: string, file2Path: string, jobId: string, downloadCsv: boolean = false) {
    const startTime = new Date();
    let logUpdate: any;
    try {
      const file1Data: any[] = [];
      const file2Data: any[] = [];
      let globalData = await this.globalModel.find();
      if (!globalData.length) {
        throw new HttpException({
          message: 'Your Global Configuration is not setup completely',
          status: 400
        }, HttpStatus.BAD_REQUEST);
      }

      globalData.forEach(obj => { this.variables[obj.key] = obj; });

      if (!file1Path) {
        logUpdate = await this.uploadLog.create({
          batchNo: `${Date.now()}`,
          uploadedAt: startTime,
          raw_log_path: file1Path,
          payment_log_path: file2Path,
          key: 'inputFiles',
          status: 'Failed',
          uploadedBy: userEmail,
          remarks: 'File UploadUpload Failed, processing Stopped',
          log: [{
            description: "Uploading Failed for the raw data log",
            status: "Failed",
            errorDetail: "Missing file1Path for raw data log"
          }
          ],
        }
        )

        throw new HttpException({
          message: 'Missing raw data file',
          status: 400
        }, HttpStatus.BAD_REQUEST);
      }
      else {
        logUpdate = await this.uploadLog.create({
          batchNo: `${Date.now()}`,
          uploadedAt: startTime,
          raw_log_path: file1Path,
          payment_log_path: file2Path,
          status: 'Processing',
          key: 'inputFiles',
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

      const paymentDataMap = new Map<string, any>();
      if (file2Path !== "") {
        console.log(`📂 Reading Payment Log file: ${file2Path}`);
        await new Promise((resolve, reject) => {
          fs.createReadStream(file2Path)
            .pipe(csv())
            .on('headers', async (headers) => {
              const normalizedHeaders = headers.map((header) =>
                header.replace(/^\ufeff/, '').trim()
              );
              try {
                validateHeaders(normalizedHeaders, file2HeadersIncludeSchema);
              } catch (error) {
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
                  { message: 'Validation failed for payment log headers', status: 400 },
                  HttpStatus.BAD_REQUEST,
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
                const paymentId = normalizedRow.paymentId?.trim();
                if (paymentId) paymentDataMap.set(paymentId, normalizedRow);
              }
            })
            // .on('end', resolve)
            .on('end', () => {
              console.log(`✅ Finished reading Payment Log. Records: ${paymentDataMap.size}`);
              resolve(true);
            })
            .on('error', reject);
        });
      }

      const batchSize = 50000;
      let batch: any[] = [];
      let rowIndex = 0;
      let batchNumber = 1;

      console.log(`📂 Reading Raw Log file in batches of ${batchSize}: ${file1Path}`);
      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file1Path).pipe(csv());

        stream
          .on('headers', async (headers) => {
            const normalizedHeaders = headers.map((header) =>
              header.replace(/^\ufeff/, '').trim()
            );
            try {
              validateHeaders(normalizedHeaders, file1HeadersIncludeSchema);
            } catch (error) {
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
                { message: 'Validation failed for raw log headers', status: 400 },
                HttpStatus.BAD_REQUEST,
              ));
            }
          })
          .on('data', async (row) => {
            stream.pause(); // pause while we process

            const normalizedRow: any = {};
            let isEmptyRow = true;

            for (const key in row) {
              const normalizedKey = key.replace(/^\ufeff/, '').trim();
              const value = row[key]?.trim();
              normalizedRow[normalizedKey] = value;
              if (value) isEmptyRow = false;
            }

            if (!isEmptyRow) {
              batch.push(normalizedRow);
              rowIndex++;
            }

            if (batch.length >= batchSize) {
              console.log(`🚀 Processing batch #${batchNumber} (rows ${rowIndex - batch.length + 1} → ${rowIndex})`,);
              await this.processAndInsertBatch(batch, paymentDataMap, logUpdate, batchNumber, rowIndex - batch.length, jobId);
              console.log(`✅ Finished batch #${batchNumber}`);
              batch = [];
              batchNumber++;
            }

            stream.resume();
          })
          .on('end', async () => {
            if (batch.length > 0) {
              console.log(`🚀 Processing final batch #${batchNumber} (rows ${rowIndex - batch.length + 1} → ${rowIndex})`,);
              await this.processAndInsertBatch(batch, paymentDataMap, logUpdate, batchNumber, rowIndex - batch.length, jobId);
              console.log(`✅ Finished final batch #${batchNumber}`);
            }
            // 🔽 Migrate temp → final
            console.log(`🎉 All ${rowIndex} rows processed successfully`);

            await this.tempLogModel.aggregate([
              // Filter early by jobId
              { $match: { jobId: jobId } },

              {
                $facet: {
                  // ---------------- Pipeline 1: Merchant-based ----------------
                  merchantBased: [
                    {
                      $match: {
                        success: true,
                        lfiChargable: true,
                        "payment_logs.merchant_id": { $ne: null },
                        "raw_api_log_data.payment_type": { $ne: "LargeValueCollection" }
                      }
                    },
                    {
                      $addFields: {
                        date: {
                          $dateTrunc: {
                            date: "$raw_api_log_data.timestamp",
                            unit: "day"
                          }
                        },
                        amount: {
                          $toDouble: "$payment_logs.amount"
                        }
                      }
                    },
                    // 3. Sort (important for "who comes first")
                    {
                      $sort: {
                        "payment_logs.merchant_id": 1,
                        date: 1,
                        "raw_api_log_data.timestamp": 1
                      }
                    },
                    // 4. Running total per merchant/day
                    {
                      $setWindowFields: {
                        partitionBy: {
                          merchantId: "$payment_logs.merchant_id",
                          date: "$date"
                        },
                        sortBy: {
                          "raw_api_log_data.timestamp": 1
                        },
                        output: {
                          runningTotal: {
                            $sum: "$amount",
                            window: {
                              documents: ["unbounded", "current"]
                            }
                          }
                        }
                      }
                    },
                    // 5. Apply free limit of 200
                    {
                      $addFields: {
                        appliedLimit: {
                          $cond: [
                            {
                              $lte: ["$runningTotal", this.variables.nonLargeValueFreeLimitMerchant.value]
                            },
                            "$amount",
                            {
                              $cond: [
                                {
                                  $lte: [
                                    {
                                      $subtract: [
                                        "$runningTotal",
                                        "$amount"
                                      ]
                                    },
                                    this.variables.nonLargeValueFreeLimitMerchant.value
                                  ]
                                },
                                {
                                  $subtract: [
                                    this.variables.nonLargeValueFreeLimitMerchant.value,
                                    {
                                      $subtract: [
                                        "$runningTotal",
                                        "$amount"
                                      ]
                                    }
                                  ]
                                },
                                0
                              ]
                            }
                          ]
                        }
                      }
                    },
                    // 6. Chargeable amount and flags
                    {
                      $addFields: {
                        chargeableAmount: {
                          $subtract: ["$amount", "$appliedLimit"]
                        },
                        limitApplied: {
                          $gt: ["$appliedLimit", 0]
                        }
                      }
                    },
                    // 7. (Optional) Calculate fee
                    {
                      $addFields: {
                        calculatedFee: {
                          $multiply: ["$chargeableAmount", { $divide: [this.variables.nonLargeValueMerchantBps.value, 10000] }]  // 38 bps = 0.0038
                        },
                        applicableFee: {
                          $cond: [
                            { $gt: [{ $multiply: ["$chargeableAmount", { $divide: [this.variables.nonLargeValueMerchantBps.value, 10000] }] }, this.variables.nonLargeValueCapMerchant.value] },
                            this.variables.nonLargeValueCapMerchant.value,
                            { $multiply: ["$chargeableAmount", { $divide: [this.variables.nonLargeValueMerchantBps.value, 10000] }] }
                          ]
                        }
                      }
                    },
                    {
                      $addFields: {
                        unit_price: { $divide: [this.variables.nonLargeValueMerchantBps.value, 10000] },
                        volume: "$chargeableAmount",
                        appliedLimit: "$appliedLimit",
                        limitApplied: "$limitApplied",
                        isCapped: { $gt: ["$calculatedFee", this.variables.nonLargeValueCapMerchant.value] },
                        cappedAt: {
                          $cond: [
                            { $gt: ["$calculatedFee", this.variables.nonLargeValueCapMerchant.value] },
                            this.variables.nonLargeValueCapMerchant.value,
                            0
                          ]
                        }
                      }
                    }
                  ],

                  // ---------------- Pipeline 2: LFI-based ----------------
                  lfiBased: [
                    {
                      $match: {
                        success: true,
                        lfiChargable: true,
                        group: "data",
                        type: { $in: ["NA", "corporate"] }
                      }
                    },
                    {
                      $addFields: {
                        psuId: "$raw_api_log_data.psu_id",
                        tpp_id: "$raw_api_log_data.tpp_id",
                        isAttended: "$raw_api_log_data.is_attended",
                        date: {
                          $dateTrunc: {
                            date: "$raw_api_log_data.timestamp",
                            unit: "day"
                          }
                        },
                        numberOfPages: {
                          $toInt: "$numberOfPages"
                        }
                      }
                    },
                    // 3. Lookup LFI data for free limits and mdp_rate
                    {
                      $lookup: {
                        from: "lfi_data",
                        localField: "raw_api_log_data.lfi_id",
                        foreignField: "lfi_id",
                        as: "lfiData"
                      }
                    },
                    {
                      $unwind: "$lfiData"
                    },
                    // 4. Add margin and multiplier
                    {
                      $addFields: {
                        margin: {
                          $cond: [
                            {
                              $eq: ["$isAttended", true]
                            },
                            "$lfiData.free_limit_attended",
                            "$lfiData.free_limit_unattended"
                          ]
                        },
                        lfiMultiplier: {
                          $cond: [
                            "$raw_api_log_data.is_large_corporate",
                            this.variables.dataLargeCorporateMdp.value,
                            // your corporate multiplier
                            "$lfiData.mdp_rate"
                          ]
                        }
                      }
                    },
                    // 5. Sort for running totals
                    {
                      $sort: {
                        psuId: 1,
                        tpp_id: 1,
                        isAttended: 1,
                        date: 1,
                        "raw_api_log_data.timestamp": 1
                      }
                    },
                    // 6. Running total per PSU/date/isAttended/tpp
                    {
                      $setWindowFields: {
                        partitionBy: {
                          psuId: "$psuId",
                          date: "$date",
                          isAttended: "$isAttended",
                          tpp_id: "$tpp_id"
                        },
                        sortBy: {
                          "raw_api_log_data.timestamp": 1
                        },
                        output: {
                          runningTotal: {
                            $sum: "$numberOfPages",
                            window: {
                              documents: ["unbounded", "current"]
                            }
                          },
                          prevRunning: {
                            $sum: "$numberOfPages",
                            window: {
                              documents: ["unbounded", -1]
                            }
                          }
                        }
                      }
                    },
                    // 7. Calculate appliedLimit based on margin
                    {
                      $addFields: {
                        appliedLimit: {
                          $cond: [
                            {
                              $lte: ["$runningTotal", "$margin"]
                            },
                            "$numberOfPages",
                            {
                              $cond: [
                                {
                                  $lte: ["$prevRunning", "$margin"]
                                },
                                {
                                  $subtract: [
                                    "$margin",
                                    "$prevRunning"
                                  ]
                                },
                                0
                              ]
                            }
                          ]
                        }
                      }
                    },
                    // 8. Chargeable amount and limit flag
                    {
                      $addFields: {
                        chargeableAmount: {
                          $subtract: [
                            "$numberOfPages",
                            "$appliedLimit"
                          ]
                        },
                        limitApplied: {
                          $gt: ["$appliedLimit", 0]
                        }
                      }
                    },
                    // 9. Calculate fee
                    {
                      $addFields: {
                        calculatedFee: {
                          $multiply: [
                            "$chargeableAmount",
                            "$lfiMultiplier"
                          ]
                        },
                        applicableFee: {
                          $multiply: [
                            "$chargeableAmount",
                            "$lfiMultiplier"
                          ]
                        }
                      }
                    },
                    // 10. Keep only final fields
                    {
                      $addFields: {
                        unit_price: "$lfiMultiplier",
                        volume: "$chargeableAmount",
                        appliedLimit: "$appliedLimit",
                        limitApplied: "$limitApplied",
                        applicableFee: { $round: ["$applicableFee", 2] },
                        calculatedFee: { $round: ["$calculatedFee", 2] }
                        // paymentId: "$payment_logs.payment_id",
                        // lfi_id: "$raw_api_log_data.lfi_id",
                        // charge: "$calculatedFee"
                      }
                    }
                  ],

                  // ---------------- Pipeline 3: Discount-based ----------------
                  discountBased: [
                    {
                      $match: {
                        success: true,
                        chargeable: true,
                        discountType: { $in: ["balance", "confirmation"] }
                      }
                    },
                    {
                      $lookup: {
                        from: "temp_logs",
                        let: {
                          psuId: "$raw_api_log_data.psu_id",
                          ts: "$raw_api_log_data.timestamp"
                        },
                        pipeline: [
                          {
                            $match: {
                              $expr: {
                                $and: [
                                  {
                                    $eq: [
                                      "$raw_api_log_data.psu_id",
                                      "$$psuId"
                                    ]
                                  },
                                  {
                                    $eq: ["$chargeable", true]
                                  },
                                  {
                                    $eq: ["$success", true]
                                  },
                                  {
                                    $not: [
                                      {
                                        $in: [
                                          "$discountType",
                                          [
                                            "balance",
                                            "confirmation"
                                          ]
                                        ]
                                      }
                                    ]
                                  }
                                ]
                              }
                            }
                          },
                          {
                            $sort: {
                              "raw_api_log_data.timestamp": -1
                            }
                          } // latest first
                        ],
                        as: "otherRecords"
                      }
                    },
                    // 3. Compute discounted flag and api_hub_fee based on 2-hour window
                    {
                      $addFields: {
                        discountCheck: {
                          $size: {
                            $filter: {
                              input: "$otherRecords",
                              as: "other",
                              cond: {
                                $lte: [
                                  {
                                    $divide: [
                                      { $abs: { $subtract: ["$$other.raw_api_log_data.timestamp", "$raw_api_log_data.timestamp"] } },
                                      1000 * 60 * 60
                                    ]
                                  },
                                  this.variables.discountHourValue.value // 2-hour window
                                ]
                              }
                            }
                          }
                        }
                      }
                    },
                    {
                      $addFields: {
                        discounted: { $gt: ["$discountCheck", 0] },
                        api_hub_fee: {
                          $cond: [{ $gt: ["$discountCheck", 0] }, this.variables.discountApiHubFee.value, "$api_hub_fee"]
                        },
                        applicableApiHubFee: {
                          $multiply: [
                            "$apiHubVolume",
                            { $cond: [{ $gt: ["$discountCheck", 0] }, this.variables.discountApiHubFee.value, "$api_hub_fee"] }
                          ]
                        }
                      }
                    },
                    {
                      $unset: ["discountCheck", "otherRecords"]
                    }
                  ]
                }
              },

              // Merge all facets into one array
              {
                $project: {
                  allDocs: { $concatArrays: ["$merchantBased", "$lfiBased", "$discountBased"] }
                }
              },
              { $unwind: "$allDocs" },
              { $replaceRoot: { newRoot: "$allDocs" } },

              // Finally update logs
              {
                $merge: {
                  into: "temp_logs",
                  on: "_id",            // match by _id
                  whenMatched: "merge", // update matched docs
                  whenNotMatched: "discard"
                }
              }
            ]);
            await this.tempLogModel.aggregate([
              { $match: { jobId: jobId } },
              // { $out: "logs" }
              {
                $merge: {
                  into: "logs",            // final collection
                  on: "_id",               // use _id to match
                  whenMatched: "merge",    // update existing docs
                  whenNotMatched: "insert" // keep old, insert new
                }
              }
            ]);
            await this.tempLogModel.deleteMany({ jobId: jobId });
            console.log("✅ Migration from temp_logs to final_logs completed.");

            resolve(true);
          })
          .on('error', reject);
      });
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationTime = await this.formatDuration(durationMs);
      await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
        $set: {
          status: 'Completed',
          completedAt: endTime,
          duration: durationTime,
          remarks: `File processed successfully. Duration: ${durationTime}`
        },
        $push: {
          log: {
            description: `Processing completed at ${endTime} (Duration: ${durationTime})`,
            status: "Completed",
            errorDetail: null
          }
        }
      });
      return "CSV processed in streaming batches";
    } catch (err) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationTime = await this.formatDuration(durationMs);
      if (logUpdate?._id) {
        await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
          $set: {
            status: 'Failed',
            completedAt: endTime,
            duration: durationTime,
            remarks: `Processing failed after ${durationTime}}`
          },
          $push: {
            log: {
              description: `Failed at ${endTime} (Duration: ${durationTime})`,
              status: "Failed",
              errorDetail: err.message || 'Unknown error'
            }
          }
        });
      }
      throw err;
    }
  }

  private async processAndInsertBatch(
    batch: any[],
    paymentDataMap: Map<string, any>,
    logUpdate: any,
    batchNumber: number,
    offset: number,
    jobId: string
  ) {
    console.log(`🔄 Merging ${batch.length} rows in batch #${batchNumber}...`);

    const mergedBatch = await Promise.all(
      batch.map(async (rawApiRecord, index) => {
        const globalIndex = offset + index;

        if ((index + 1) % 5000 === 0) {
          console.log(`⏳ Progress: row ${globalIndex + 1} inside batch #${batchNumber}`);
        }

        const paymentId = rawApiRecord.paymentId?.trim();
        let paymentRecord: any = null;

        // --- Raw Log Validations ---
        const errorPremiumAmount =
          rawApiRecord.PremiumAmountExcludingVAT !== "" &&
          isNaN(parseFloat(rawApiRecord.PremiumAmountExcludingVAT));

        // if (errorPremiumAmount) {
        //   await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
        //     $set: { status: 'Failed', remarks: `Failed to validate 'Raw Log File'` },
        //     $push: {
        //       log: {
        //         description: `Validation error at row ${globalIndex + 2} for PremiumAmountExcludingVAT`,
        //         status: 'Failed',
        //         errorDetail: null,
        //       },
        //     },
        //   });
        //   throw new HttpException(
        //     { message: `Invalid PremiumAmountExcludingVAT at row ${globalIndex + 2}`, status: 400 },
        //     HttpStatus.BAD_REQUEST,
        //   );
        // }

        // --- Payment Log Validations ---
        if (paymentId) {
          paymentRecord = paymentDataMap.get(paymentId);

          if (!paymentRecord) {
            await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
              $set: { status: 'Failed', remarks: `Failed to validate 'Raw Log File'` },
              $push: {
                log: {
                  description: `No matching record in Payment Log for paymentId '${paymentId}' at row ${globalIndex + 2}`,
                  status: 'Failed',
                  errorDetail: null,
                },
              },
            });
            throw new HttpException(
              { message: `No matching payment record found for paymentId '${paymentId}' at row ${globalIndex + 2}`, status: 400 },
              HttpStatus.BAD_REQUEST,
            );
          }

          if (!this.paymentTypes.includes(paymentRecord.paymentType)) {
            await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
              $set: { status: 'Failed', remarks: `Failed to validate 'Payment Log File'` },
              $push: {
                log: {
                  description: `Invalid paymentType at row ${globalIndex + 2}, value: '${paymentRecord.paymentType}'`,
                  status: 'Failed',
                  errorDetail: null,
                },
              },
            });
            throw new HttpException(
              { message: `Invalid paymentType at row ${globalIndex + 2}`, status: 400 },
              HttpStatus.BAD_REQUEST,
            );
          }

          if (paymentRecord.amount !== "" && isNaN(parseFloat(paymentRecord.amount))) {
            await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
              $set: { status: 'Failed', remarks: `Failed to validate 'Payment Log File'` },
              $push: {
                log: {
                  description: `Invalid amount at row ${globalIndex + 2}, value: '${paymentRecord.amount}'`,
                  status: 'Failed',
                  errorDetail: null,
                },
              },
            });
            throw new HttpException(
              { message: `Invalid amount at row ${globalIndex + 2}`, status: 400 },
              HttpStatus.BAD_REQUEST,
            );
          }
        }
        // --- Utility for boolean parsing ---
        const parseBoolean = async (
          value: string,
          idx: number,
          field: string,
          rawData: boolean,
        ) => {
          if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1') return true;
            if (normalized === 'false' || normalized === '0') return false;
            if (normalized === '') return null;
          }
          await this.uploadLog.findByIdAndUpdate(logUpdate._id, {
            $set: {
              status: 'Failed',
              remarks: `Failed to validate ${rawData ? 'Raw Log File' : 'Payment Log File'}`,
            },
            $push: {
              log: {
                description: rawData
                  ? `Validation error in row ${idx + 2} for field ${field} in Raw Log File, value: ${value}`
                  : `Validation error in Payment Log for Payment ID: ${idx}, field ${field}, value: ${value}`,
                status: 'Failed',
                errorDetail: null,
              },
            },
          });
          throw new HttpException(
            {
              message: rawData
                ? `Invalid boolean value in Raw Log row ${idx + 2} for field ${field}, value: ${value}`
                : `Invalid boolean in Payment Log for Payment ID ${idx}, field ${field}, value: ${value}`,
              status: 400,
            },
            HttpStatus.BAD_REQUEST,
          );
        };

        // --- Merge raw + payment log ---
        return {
          jobId: jobId,
          "raw_api_log_data.timestamp": rawApiRecord.timestamp || null,
          "raw_api_log_data.tpp_name": rawApiRecord.tppName || null,
          "raw_api_log_data.lfi_name": rawApiRecord.lfiName || null,
          "raw_api_log_data.lfi_id": rawApiRecord.lfiId || null,
          "raw_api_log_data.tpp_id": rawApiRecord.tppId || null,
          "raw_api_log_data.tpp_client_id": rawApiRecord.tppClientId || null,
          "raw_api_log_data.api_set_sub": rawApiRecord.apiSet || null,
          "raw_api_log_data.http_method": rawApiRecord.httpMethod || null,
          "raw_api_log_data.url": rawApiRecord.url || "/No-url-provided",
          "raw_api_log_data.tpp_response_code_group": rawApiRecord.tppResponseCodeGroup || null,
          "raw_api_log_data.execution_time": rawApiRecord.executionTime || null,
          "raw_api_log_data.interaction_id": rawApiRecord.interactionId || null,
          "raw_api_log_data.resource_name": rawApiRecord.resourceName || null,
          "raw_api_log_data.lfi_response_code_group": rawApiRecord.lfIResponseCodeGroup || null,
          "raw_api_log_data.is_attended": await parseBoolean(rawApiRecord.isAttended, globalIndex, 'isAttended', true),
          "raw_api_log_data.records": rawApiRecord.records || null,
          "raw_api_log_data.payment_type": rawApiRecord.paymentType || null,
          "raw_api_log_data.payment_id": rawApiRecord.paymentId || null,
          "raw_api_log_data.merchant_id": rawApiRecord.merchantId || null,
          "raw_api_log_data.psu_id": rawApiRecord.psuId || null,
          "raw_api_log_data.is_large_corporate": await parseBoolean(rawApiRecord.isLargeCorporate, globalIndex, 'isLargeCorporate', true),
          "raw_api_log_data.user_type": rawApiRecord.userType || null,
          "raw_api_log_data.purpose": rawApiRecord.purpose || null,
          "raw_api_log_data.PremiumAmountExcludingVAT": rawApiRecord.PremiumAmountExcludingVAT || null,
          "raw_api_log_data.SalaryBand": rawApiRecord.SalaryBand || null,

          "payment_logs.timestamp": paymentRecord?.timestamp || null,
          "payment_logs.tpp_name": paymentRecord?.tppName || null,
          "payment_logs.lfi_name": paymentRecord?.lfiName || null,
          "payment_logs.lfi_id": paymentRecord?.lfiId || null,
          "payment_logs.tpp_id": paymentRecord?.tppId || null,
          "payment_logs.tpp_client_id": paymentRecord?.tppClientId || null,
          "payment_logs.status": paymentRecord?.status || null,
          "payment_logs.currency": paymentRecord?.currency || null,
          "payment_logs.amount": paymentRecord?.amount || null,
          "payment_logs.payment_consent_type": paymentRecord?.paymentConsentType || null,
          "payment_logs.payment_type": paymentRecord?.paymentType || null,
          "payment_logs.transaction_id": paymentRecord?.transactionId || null,
          "payment_logs.payment_id": paymentId || null,
          "payment_logs.merchant_id": paymentRecord?.merchantId || null,
          "payment_logs.psu_id": paymentRecord?.psuId || null,
          "payment_logs.is_large_corporate": await parseBoolean(paymentRecord?.isLargeCorporate || '', globalIndex, 'isLargeCorporate', false),
          "payment_logs.number_of_successful_transactions": paymentRecord?.numberOfSuccessfulTransactions || null,
          "payment_logs.international_payment": paymentRecord?.internationalPayment == 'TRUE' ? true : false,
        };
      }),
    );
    console.log("merge completed for the batch, starting calculations...");

    const chargeFile = await this.chargableConvertion(mergedBatch, logUpdate._id);
    console.log('stage 1 completed');

    const lfitoTppCharge = await this.calculateFeeForLFItoTpp(chargeFile, logUpdate._id);
    console.log('stage 2 completed');

    let response = await this.populateLfiData(lfitoTppCharge);
    console.log('stage 3 completed');

    let result = await this.populateTppData(lfitoTppCharge);
    console.log('stage 4 completed');

    const totalHubFeecalculation = await this.calculateTotalApiHubFee(lfitoTppCharge);

    const existingInteractionIds = await this.logModel.distinct("raw_api_log_data.interaction_id");
    const processedRecords = totalHubFeecalculation.map((record) => {
      const isDuplicate = existingInteractionIds.includes(record["raw_api_log_data.interaction_id"]);
      return {
        ...record,
        duplicate: isDuplicate,
      };
    });

    console.log(`📦 Inserting batch #${batchNumber} into DB (${mergedBatch.length} records)...`);
    console.time(`⏳ Batch #${batchNumber} insertion time`);
    await this.tempLogModel.insertMany(processedRecords, {
      ordered: false,
      rawResult: false,
      lean: false,
    });
    // const Model = this.tempLogModel;
    // const docs = totalHubFeecalculation.map(d => new Model(d).toObject());
    // await Model.insertMany(docs, { ordered: false });

    // const ops = totalHubFeecalculation.map(doc => ({
    //   insertOne: { document: doc }
    // }));

    // await this.tempLogModel.bulkWrite(ops, {
    //   ordered: false,
    // });
    console.timeEnd(`⏳ Batch #${batchNumber} insertion time`);
    console.log(`✅ Batch #${batchNumber} inserted successfully`);
  }


  private async formatDuration(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${hours}h ${minutes}m ${seconds}s ${milliseconds}ms`;
  }
  async calculateTotalApiHubFee(data: any[]) {
    const results = await Promise.all(
      data.map(async (record: any) => {
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
            apiHubVolume = record.numberOfPages ?? 1;
            totalApiHubFee *= apiHubVolume;
          }
        }

        //Get TPP ID and fetch from DB
        const tppId = record.successfullQuote && record.success ? record["raw_api_log_data.tpp_id"] : null;
        const lfiId = record.successfullQuote && record.success ? record["raw_api_log_data.lfi_id"] : null;
        let brokerage_fee = 0;
        let percentage = 0;
        let brokerageConfig_id: any = null;
        let serviceStatus: boolean = false;
        if (tppId && lfiId) {
          const tppDoc = await this.TppModel.findOne({
            tpp_id: tppId
          }, {
            // brokerage_fee: 1,
            serviceStatus: 1,
            _id: 0
          }).lean();
          serviceStatus = tppDoc?.serviceStatus ?? false;
          if (tppDoc?.serviceStatus) {
            const premium = parseFloat(record["raw_api_log_data.PremiumAmountExcludingVAT"] || 0);
            const configData = await this.brokerageConfigModel.findOne({
              tpp_id: tppId, lfi_id: lfiId, serviceStatus: true
            })
            if (configData) {
              percentage = configData.configuration_fee[record.type] || 0;
              brokerageConfig_id = configData._id;
            } else {
              console.log(record.type, record["raw_api_log_data.interaction_id"], "No brokerage config found, applying default");
              percentage = record.type == "employment_ILO" ? this.variables.defaultEmployment_ILOValue.value : this.variables[`default${record.type.charAt(0).toUpperCase() + record.type.slice(1)}Value`]?.value || 0;
            }
            if (record["raw_api_log_data.SalaryBand"] === "BelowAED4000PerMonth" || record["raw_api_log_data.SalaryBand"] === "NoSalary") {
              percentage = percentage >= 5 ? this.variables.below4000BandValue?.value : percentage;
              record.isCapped = percentage >= 5 ? true : false;
              record.cappedAt = percentage >= 5 ? 5 : 0;
            } else if (record["raw_api_log_data.SalaryBand"] === "AED4000ToAED12000PerMonth" || record["raw_api_log_data.SalaryBand"] === "AED12001AndAbove") {
              percentage = percentage;
            }
            brokerage_fee = parseFloat((premium * (percentage / 100)).toFixed(2));
          }
        }
        return {
          ...record,
          applicableApiHubFee: totalApiHubFee.toFixed(3),
          apiHubVolume,
          percentage,
          brokerage_fee,
          brokerageConfig_id,
          serviceStatus
        };
      })
    );
    return results;
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
    try {
      const uniqueLfiIds = Array.from(
        new Set(
          rawData
            .map(data => data["raw_api_log_data.lfi_id"])
            .filter(id => id != null)
        )
      );

      const lfiDataToInsert = uniqueLfiIds.map(lfi_id => ({
        lfi_id,
        lfi_name: rawData.find(data => data["raw_api_log_data.lfi_id"] === lfi_id)["raw_api_log_data.lfi_name"],
        mdp_rate: parseFloat((Math.random() * (3 - 2) + 2).toFixed(2)),
        free_limit_attended: this.variables.attendedCallFreeLimit.value,
        free_limit_unattended: this.variables.unAttendedCallFreeLimit.value,
      }));

      const results: any[] = [];

      for (const lfiData of lfiDataToInsert) {
        try {
          const existing = await this.lfiModel.findOne({ lfi_id: lfiData.lfi_id });

          if (!existing) {
            const inserted = await this.lfiModel.create(lfiData);
            results.push(inserted);
          } else {
            console.log(`⚠️ Duplicate LFI ID skipped: ${lfiData.lfi_id}`);
          }
        } catch (err) {
          console.error(`❌ Error inserting LFI ID ${lfiData.lfi_id}:`, err.message);
        }
      }

      return results;
    } catch (err) {
      console.error("❌ Fatal error in populateLfiData:", err.message);
      throw err; // rethrow so caller knows something went wrong
    }
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


  async feeCalculationForLfi(data: any, logId: string) {
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
        data.map(async (record, index) => {
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

            // console.log('iam key', key)
            // console.log('iam bool data', isAttended)
            // console.log('iam tpp data', tpp_id)

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
        if (transaction.lfiChargable && transaction.success && transaction["payment_logs.merchant_id"] != null) {

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
              calculatedFee: parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.bulkLargeCorporatefee.value).toFixed(3)),
              applicableFee: parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.bulkLargeCorporatefee.value).toFixed(3)), // Ensure 
              type: "corporate",
              unit_price: this.variables.bulkLargeCorporatefee.value,
              volume: parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1),
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
                calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.paymentLargeValueFee.value).toFixed(3));
                applicableFee = calculatedFee
                unit_price = this.variables.paymentLargeValueFee.value;
                volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1);
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
                  // applicableFee = parseFloat((parseInt(record["payment_logs.amount"]) > this.nonLargeValueCapMerchantCheck ? this.variables.nonLargeValueCapMerchant.value : calculatedFee).toFixed(3));
                  applicableFee = parseFloat((calculatedFee > this.variables.nonLargeValueCapMerchant.value ? this.variables.nonLargeValueCapMerchant.value : calculatedFee).toFixed(3));
                  unit_price = (this.variables.nonLargeValueMerchantBps.value / 10000);
                  volume = filteredTransaction.chargeableAmount ?? 0;
                  appliedLimit = filteredTransaction.appliedLimit;
                  limitApplied = filteredTransaction.appliedLimit > 0;
                  isCapped = calculatedFee > this.variables.nonLargeValueCapMerchant.value; // Assign boolean value
                  cappedAt = isCapped ? this.variables.nonLargeValueCapMerchant.value : 0;

                }
              } else {
                calculatedFee = parseFloat((parseInt(record["payment_logs.amount"]) * (this.variables.nonLargeValueMerchantBps.value / 10000)).toFixed(3));
                applicableFee = parseFloat((calculatedFee > this.variables.nonLargeValueCapMerchant.value ? this.variables.nonLargeValueCapMerchant.value : calculatedFee).toFixed(3));
                unit_price = (this.variables.nonLargeValueMerchantBps.value / 10000);
                volume = parseInt(record["payment_logs.amount"]) ?? 0;
                appliedLimit = 0;
                limitApplied = false;
                isCapped = calculatedFee > this.variables.nonLargeValueCapMerchant.value; // Assign boolean value
                cappedAt = isCapped ? this.variables.nonLargeValueCapMerchant.value : 0;
              }
            }

          }

          // PEER-2-PEER
          else if (record.type === 'peer-2-peer') {
            if (record.group === 'payment-bulk') {
              // if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
              //   calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.paymentLargeValueFee.value).toFixed(3));
              //   applicableFee = calculatedFee
              //   unit_price = this.variables.paymentLargeValueFee.value;
              //   volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1);

              // } else {
              calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.paymentNonLargevalueFeePeer.value).toFixed(3));

              applicableFee = parseFloat((calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? this.variables.bulkMe2mePeer2PeerCap.value : calculatedFee).toFixed(3));
              unit_price = this.variables.paymentNonLargevalueFeePeer.value;
              volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1);
              isCapped = calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? true : false // Assign boolean value
              cappedAt = isCapped ? this.variables.bulkMe2mePeer2PeerCap.value : 0;
              // }
            }
            else if (record.group === 'payment-non-bulk') {
              // if (record["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
              //   calculatedFee = parseFloat((this.variables.paymentLargeValueFee.value).toFixed(3));
              //   applicableFee = calculatedFee
              //   unit_price = this.variables.paymentLargeValueFee.value;
              //   volume = 1;

              // } else {
              calculatedFee = parseFloat(this.variables.paymentNonLargevalueFeePeer.value.toFixed(3));

              applicableFee = calculatedFee;
              unit_price = this.variables.paymentNonLargevalueFeePeer.value;
              volume = 1;
              // }
            }

          }

          // ME-2-ME
          else if (record.type === 'me-2-me') {
            if (record.group === 'payment-bulk') {
              calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.paymentFeeMe2me.value).toFixed(3));
              applicableFee = parseFloat((calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? this.variables.bulkMe2mePeer2PeerCap.value : calculatedFee).toFixed(3));
              unit_price = this.variables.paymentFeeMe2me.value;
              volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1);
              isCapped = calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? true : false
              cappedAt = isCapped ? this.variables.bulkMe2mePeer2PeerCap.value : 0;
            }
            else if (record.group === 'payment-non-bulk') {
              calculatedFee = parseFloat((this.variables.paymentFeeMe2me.value).toFixed(3));
              applicableFee = calculatedFee;
              unit_price = this.variables.paymentFeeMe2me.value;
              volume = 1;
            }
          }
          else if (record.group == 'fx') {
            calculatedFee = this.variables.fxQuotelfiFee.value;
            applicableFee = this.variables.fxQuotelfiFee.value;
            unit_price = this.variables.fxQuotelfiFee.value;
            volume = 1
          }

          // OTHER
          else if (record.type === 'NA') {
            if (record.group === 'insurance') {
              calculatedFee = 0;
              applicableFee = calculatedFee;
            } else if (record.group === 'data') {
              numberOfPages = Math.ceil(parseInt(record["raw_api_log_data.records"] ?? "0") / 100);
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
            // console.log(`Inserted merchant with ID ${merchant.merchantId}`);
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
  async calculateFeeForLFItoTpp(data: any, logId: string) {
    try {
      const calculatedData = await Promise.all(data.map(async (record: { [x: string]: string; }, recordIndex: number) => {
        let volume = 0;
        let calculatedFee = 0;
        let applicableFee = 0;
        let numberOfPages = 0;
        let unit_price = 0;
        let appliedLimit = 0;
        let limitApplied = false;
        let isCapped: boolean = false;
        let cappedAt = 0;
        if (record.lfiChargable && record.success) {

          if (record.group === "payment-bulk" && Boolean(record['raw_api_log_data.is_large_corporate'])) {

            return {
              ...record,
              calculatedFee: parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.bulkLargeCorporatefee.value).toFixed(3)),
              applicableFee: parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.bulkLargeCorporatefee.value).toFixed(3)), // Ensure 
              type: "corporate",
              unit_price: this.variables.bulkLargeCorporatefee.value,
              volume: parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1),
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
                calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.paymentLargeValueFee.value).toFixed(3));
                applicableFee = calculatedFee
                unit_price = this.variables.paymentLargeValueFee.value;
                volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1);
              }


            } else {
              calculatedFee = parseFloat((parseInt(record["payment_logs.amount"]) * (this.variables.nonLargeValueMerchantBps.value / 10000)).toFixed(3));
              applicableFee = parseFloat((calculatedFee > this.variables.nonLargeValueCapMerchant.value ? this.variables.nonLargeValueCapMerchant.value : calculatedFee).toFixed(3));
              unit_price = (this.variables.nonLargeValueMerchantBps.value / 10000);
              volume = parseInt(record["payment_logs.amount"]) ?? 0;
              appliedLimit = 0;
              limitApplied = false;
              isCapped = calculatedFee > this.variables.nonLargeValueCapMerchant.value; // Assign boolean value
              cappedAt = isCapped ? this.variables.nonLargeValueCapMerchant.value : 0;
              // }
            }

          }

          // PEER-2-PEER
          else if (record.type === 'peer-2-peer') {
            if (record.group === 'payment-bulk') {
              calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.paymentNonLargevalueFeePeer.value).toFixed(3));

              applicableFee = parseFloat((calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? this.variables.bulkMe2mePeer2PeerCap.value : calculatedFee).toFixed(3));
              unit_price = this.variables.paymentNonLargevalueFeePeer.value;
              volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1);
              isCapped = calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? true : false // Assign boolean value
              cappedAt = isCapped ? this.variables.bulkMe2mePeer2PeerCap.value : 0;
            }
            else if (record.group === 'payment-non-bulk') {
              calculatedFee = parseFloat(this.variables.paymentNonLargevalueFeePeer.value.toFixed(3));

              applicableFee = calculatedFee;
              unit_price = this.variables.paymentNonLargevalueFeePeer.value;
              volume = 1;
            }

          }

          // ME-2-ME
          else if (record.type === 'me-2-me') {
            if (record.group === 'payment-bulk') {
              calculatedFee = parseFloat((parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1) * this.variables.paymentFeeMe2me.value).toFixed(3));
              applicableFee = parseFloat((calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? this.variables.bulkMe2mePeer2PeerCap.value : calculatedFee).toFixed(3));
              unit_price = this.variables.paymentFeeMe2me.value;
              volume = parseInt(record["payment_logs.number_of_successful_transactions"] ?? 1);
              isCapped = calculatedFee > this.variables.bulkMe2mePeer2PeerCap.value ? true : false
              cappedAt = isCapped ? this.variables.bulkMe2mePeer2PeerCap.value : 0;
            }
            else if (record.group === 'payment-non-bulk') {
              calculatedFee = parseFloat((this.variables.paymentFeeMe2me.value).toFixed(3));
              applicableFee = calculatedFee;
              unit_price = this.variables.paymentFeeMe2me.value;
              volume = 1;
            }
          }
          else if (record.group == 'fx') {
            calculatedFee = this.variables.fxQuotelfiFee.value;
            applicableFee = this.variables.fxQuotelfiFee.value;
            unit_price = this.variables.fxQuotelfiFee.value;
            volume = 1
          }

          // OTHER
          else if (record.type === 'NA') {
            if (record.group === 'insurance') {
              calculatedFee = 0;
              applicableFee = calculatedFee;
            } else if (record.group === 'data') {
              const psuIdCheck = record["raw_api_log_data.psu_id"];
              if (!psuIdCheck) {
                await this.uploadLog.findByIdAndUpdate(
                  logId,
                  {
                    $set: {
                      status: 'Failed',
                      remarks: `Failed to Find PSUID in Raw Log File`,
                    },
                    $push: {
                      log: {
                        description: `Validation error at row ${recordIndex + 2} in the 'Raw Log File' PSU ID is missing or empty for success and chargeable url. Interaction Id : ${record["raw_api_log_data.interaction_id"]}`,
                        status: 'Failed',
                        errorDetail: null,
                      },
                    },
                  }
                );
                throw new HttpException({
                  message: `Validation error at row ${recordIndex + 2} in the 'Raw Log File' PSU ID is missing or empty for success and chargeable url. Interaction Id : ${record["raw_api_log_data.interaction_id"]}`,
                  status: 400
                }, HttpStatus.BAD_REQUEST);
              }
              numberOfPages = Math.ceil(parseInt(record["raw_api_log_data.records"] ?? "0") / 100);
              if (Boolean(record["raw_api_log_data.is_large_corporate"])) {
                record.type = "corporate";
              }
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


      return calculatedData;
    } catch (error) {
      console.error("Error in calculateFee:", error);
      throw new Error("Fee calculation failed");
    }
  }

  async determineChargeableAndSuccess(data: any[], apiData: any[], logId: string) {
    // Convert API data into lists of chargeable URLs with their methods
    const chargableUrls = apiData
      .filter(api => api.chargeable_api_hub_fee === true)
      .map(api => ({ endpoint: api.api_endpoint, method: api.api_operation.toUpperCase() }));

    const lfiChargableUrls = apiData
      .filter(api => api.chargeable_LFI_TPP_fee === true)
      .map(api => ({ endpoint: api.api_endpoint, method: api.api_operation.toUpperCase() }));

    const QuotChargableUrls = apiData
      .filter(api => api.chargeable_quote_fee === true)
      .map(api => ({ endpoint: api.api_endpoint, method: api.api_operation.toUpperCase() }));



    return await Promise.all(data.map(async (record, index) => {
      const rawDataEndpoint = await this.matchTemplateVersionUrl(record["raw_api_log_data.url"]);
      const rawDataMethod = record["raw_api_log_data.http_method"];


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

      const successQuote = await Promise.all(
        QuotChargableUrls.map(async (api) => {
          const urlMatch = await this.matchTemplateUrl(api.endpoint, rawDataEndpoint);
          const methodMatch = api.method.toUpperCase() === rawDataMethod.toUpperCase();
          return urlMatch && methodMatch;
        })
      ).then((results) => results.some((result) => result));

      // Determine if the record is successful based on response codes
      const success = /^2([a-zA-Z0-9]{2}|\d{2})$/.test(record["raw_api_log_data.tpp_response_code_group"])
      // &&
      //   /^2([a-zA-Z0-9]{2}|\d{2})$/.test(record["raw_api_log_data.lfi_response_code_group"]);

      if ((islfiChargable || isChargeable) && success) {
        let errorTppLfi = !record["raw_api_log_data.tpp_id"] || !record["raw_api_log_data.tpp_name"] || !record["raw_api_log_data.lfi_id"] || !record["raw_api_log_data.lfi_name"];
        if (errorTppLfi) {
          await this.uploadLog.findByIdAndUpdate(
            logId,
            {
              $set: {
                status: 'Failed',
                remarks: `Failed to validate 'Raw Log File`,
              },
              $push: {
                log: {
                  description: `Validation error at row ${index + 2} in the 'Raw Log File': 'lfiId', 'lfiName', 'tppId', or 'tppName' is missing or empty.`,
                  status: 'Failed',
                  errorDetail: null,
                },
              },
            }
          );
          throw new HttpException({
            message: `Validation error at row ${index + 2} in the 'Raw Log File': 'lfiId', 'lfiName', 'tppId', or 'tppName' is missing or empty.`,
            status: 400
          }, HttpStatus.BAD_REQUEST);
        }
        const isValidUTC = await this.isUTCString(record['raw_api_log_data.timestamp']);
        if (!isValidUTC) {
          await this.uploadLog.findByIdAndUpdate(
            logId,
            {
              $set: {
                status: 'Failed',
                remarks: `Failed to validate 'Raw Log File`,
              },
              $push: {
                log: {
                  description: `Validation error at row ${index + 2} in the 'Raw Log File': 'timestamp' is not in valid UTC format (e.g. 2025-08-28T12:34:56Z)`,
                  status: 'Failed',
                  errorDetail: null,
                },
              },
            }
          );
          throw new HttpException({
            message: `Validation error at row ${index + 2} in the 'Raw Log File': 'timestamp' is not in valid UTC format (e.g. 2025-08-28T12:34:56Z)`,
            status: 400
          }, HttpStatus.BAD_REQUEST);
        }


      }

      return {
        ...record,
        chargeable: isChargeable,
        lfiChargable: islfiChargable,
        successfullQuote: successQuote,
        success,
      };
    }));
  }
  async isUTCString(str: string): Promise<boolean> {
    return moment.utc(str, moment.ISO_8601, true).isValid() && str.endsWith("Z");
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
      if (record.success && (groupData?.key_name === 'payment-bulk' || groupData?.key_name === 'payment-non-bulk' || groupData?.key_name === 'payment-data')) {
        record.success = this.paymentStatus.includes(record['payment_logs.status'])
      }
      // if (record.chargeable && record.success &&
      //   (record["raw_api_log_data.url"].includes('confirmation-of-payee') || record["raw_api_log_data.url"].includes('balances'))) {
      //   const filterData = processedData.filter(logData =>
      //     logData["raw_api_log_data.psu_id"] === record["raw_api_log_data.psu_id"] && logData.chargeable &&
      //     logData.success &&
      //     !logData["raw_api_log_data.url"].includes('confirmation-of-payee') &&
      //     !logData["raw_api_log_data.url"].includes('balances')
      //   );

      //   if (filterData.length > 0) {
      //     const lastRecord = filterData[0];
      //     const lastRecordTime = new Date(lastRecord["raw_api_log_data.timestamp"]);
      //     const currentRecordTime = new Date(record["raw_api_log_data.timestamp"]);
      //     const timeDiff = Math.abs(currentRecordTime.getTime() - lastRecordTime.getTime());
      //     const hours = Math.ceil(timeDiff / (1000 * 60 * 60));

      //     if (hours <= this.variables.discountHourValue.value) {
      //       api_hub_fee = this.variables.discountApiHubFee.value;
      //       discounted = true;
      //     }
      //   }
      // } else 
      if (record.chargeable && record.success && group === 'insurance' && groupData?.api_category === 'Insurance Data Sharing') {
        api_hub_fee = this.variables.insuranceDataApiHubFee.value;
      } else if (record.chargeable && record.success && group === 'insurance' && groupData?.api_category === 'Insurance Quote Sharing') {
        api_hub_fee = this.variables.insuranceQuoteApiHubFee.value;
      } else if (record.chargeable && record.success && group === 'fx') {
        api_hub_fee = this.variables.fxQuoteApiHubFee.value;
      } else if (!record.chargeable || !record.success) {
        api_hub_fee = 0;
      }

      return {
        ...record,
        group,
        type: groupData?.key_name === 'payment-bulk' || groupData?.key_name === 'payment-non-bulk' ? this.getType(record) : record.successfullQuote ? groupData.commission_category || "NA" : 'NA',
        discountType: groupData?.key_name === 'balance' || groupData?.key_name === 'confirmation' ? groupData?.key_name : null,
        api_category: groupData?.api_category || null,
        discounted,
        api_hub_fee: record.chargeable ? api_hub_fee : 0,
      };
    }));
  }

  private async findGroupData(record: any, apiData: any[]): Promise<any> {
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

  async chargableConvertion(data: any, logId: string) {
    try {
      // console.log(globalData)
      const apiData = await this.apiModel.find({
        $or: [
          { chargeable_api_hub_fee: true },
          { chargeable_LFI_TPP_fee: true },
          { chargeable_quote_fee: true },
        ]
      });
      const processedData = await this.determineChargeableAndSuccess(data, apiData, logId);
      console.log("Charge Convertion Done");
      const updatedData = await this.calculateApiHubFee(processedData, apiData,);
      console.log("API Hub Fee Calculation Done");
      return updatedData;
    } catch (error) {
      console.error("Error in chargableConvertion:", error);
      throw new Error(error);
    }
  }
  getType(logEntry: any) {
    let type = "NA";
    if (logEntry["payment_logs.merchant_id"] != null || this.paymentTypesForMerchant.includes(logEntry["raw_api_log_data.payment_type"])) {
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
      // console.log("url",url)
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

  async getMasterLogCsv(batchId: string) {
    try {
      const logData = await this.uploadLog.findOne({ _id: batchId });
      if (!logData) {
        throw new HttpException('Batch ID not found', HttpStatus.NOT_FOUND);
      }
      const filePath = logData.master_log_path;
      return filePath;
    } catch (error) {
      console.error("Error in getMasterLogCsv:", error);
      throw new Error("Failed to retrieve Master Data CSV");

    }
  }

  async getUploadLogData(key: string, paginationDTO: PaginationDTO) {
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
        options.$or = [{ "fileName": searchRegex }, { "batchNo": search }, { "uploadedBy": searchRegex }];
      }
      if (key) {
        options.key = key;
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

  async updateTppAndLfi(userEmail: string, organizationPath: string, fileName: string) {
    let logUpdate: any;
    try {
      if (!organizationPath) {
        logUpdate = await this.uploadLog.create({
          batchNo: `${Date.now()}`,
          uploadedAt: new Date(),
          master_log_path: organizationPath,
          fileName: fileName,
          key: 'lfiTppMaster',
          status: 'Failed',
          uploadedBy: userEmail,
          remarks: 'File UploadUpload Failed, processing stopped',
          log: [
            {
              description: "Uploading Failed for TPP LFI Master data file",
              status: "Failed",
              errorDetail: "Missing file1Path for Tpp LFI Master data file"
            }
          ],
        }
        )

        throw new HttpException({
          message: 'Missing TPP LFI Master data file',
          status: 400
        }, HttpStatus.BAD_REQUEST);
      }
      else {
        logUpdate = await this.uploadLog.create({
          batchNo: `${Date.now()}`,
          uploadedAt: new Date(),
          master_log_path: organizationPath,
          fileName: fileName,
          status: 'Processing',
          key: 'lfiTppMaster',
          uploadedBy: userEmail,
          remarks: 'File Uploaded, processing started',
          log: [
            {
              description: "Processing and updating TPP and LFI Master data file",
              status: "In Progress",
              errorDetail: null
            }
          ]
        }
        )
      }
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
              await this.uploadLog.findByIdAndUpdate(
                logUpdate._id,
                {
                  $set: {
                    status: 'Failed',
                    remarks: 'Failed to validate Organization data headers',
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
      // console.log('iam organizationData', organizationData)
      await this.uploadLog.findByIdAndUpdate(
        logUpdate._id,
        {
          $push: {
            log: {
              description: `Header Validation Completed For Organization csv`,
              status: 'Completed',
              errorDetail: null
            }
          }
        }
      );
      const lfiData = organizationData.filter(record => record.Size === 'LFI' && record.ContactType === 'Business');
      const tppData = organizationData.filter(record => record.Size === 'TPP' && record.ContactType === 'Business');

      if (lfiData.length > 0) {
        await this.bulkCreateOrUpdateLFI(lfiData);
      }
      if (tppData.length > 0) {
        await this.bulkCreateOrUpdateTPP(tppData);
      }

      await this.uploadLog.findByIdAndUpdate(
        logUpdate._id,
        {
          $set: {
            status: 'Completed',
            remarks: 'Database Process Completed',
          },
          $push: {
            log: {
              description: `Filtering Completed and the Latest Master Data Updated In the Database`,
              status: 'Completed',
              errorDetail: null
            },
          },
        }
      );
      return {
        lfiData: lfiData.length,
        tppData: tppData.length,
      };
    } catch (error) {
      console.error('Error reading organization data:', error);
      await this.uploadLog.findByIdAndUpdate(
        logUpdate._id,
        {
          $set: {
            status: 'Failed',
            remarks: 'Failed to Process Organization data',
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
          upsert: true,
        },
      };
    });
    await this.TppModel.bulkWrite(bulkOps);
  }

  async filterFiles(file1Path: string) {
    const file1Data: any[] = [];
    const interactionIds: Set<string> = new Set();
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(file1Path)
        .pipe(csv())
        .on('headers', (headers) => {
          headers.map((header) => header.replace(/^\ufeff/, '').trim());
        })
        .on('data', (row) => {
          const interactionId = row['interactionId']?.trim();
          if (interactionId) {
            interactionIds.add(interactionId);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    console.log(`Extracted InteractionIds: ${Array.from(interactionIds).join(', ')}`);
    try {
      const logs = await this.logModel.find({});
      console.log('logs length', logs[0].raw_api_log_data.interaction_id);
      const logsToRemove = logs.filter((log) => interactionIds.has(log.raw_api_log_data.interaction_id));

      console.log(`Matching logs to remove: ${logsToRemove.length}`);

      const removalPromises = logsToRemove.map((log) => this.logModel.deleteOne({ _id: log._id }));
      await Promise.all(removalPromises);

      console.log(`Successfully removed ${logsToRemove.length} logs.`);
      return logsToRemove.length;
    } catch (error) {
      console.error('Error removing logs:', error);
      throw error;
    }
  }
}

