const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Test data from your CSV files
const rawApiLogData = {
  _airbyte_raw_id: "0199a75f-4089-7623-aabc-436bda177781",
  _id: "68ddf8d2c7705fd5c55fd5be",
  url: "open-finance/payment/v1.2/payments",
  lfiId: "ADCBRT",
  psuId: "14207702",
  tppId: "0016920f-c806-47fd-91d6-ce81b3fa7a1e",
  apiSet: "PISP",
  lfiName: "uae-adcbrt",
  tppName: "PAY TEN PAYMENT SERVICES PROVIDER LLC",
  paymentId: "4642f164-34cf-4a64-b0f7-bcd03b5943c4",
  timestamp: "2025-09-30T13:46:08.166Z",
  httpMethod: "POST",
  isAttended: "FALSE",
  paymentType: "Collection",
  tppClientId: "26f284b9-07c9-4e1d-949d-bfab04f37be",
  resourceName: "cbuae-service-initiation",
  executionTime: "7445",
  interactionId: "e00af92e-37f5-4719-a193-60ea4b9b585c",
  isLargeCorporate: "",
  lfIResponseCodeGroup: "201",
  tppResponseCodeGroup: "2xx",
  lfiResponseCodeStatus: "201",
  tppResponseCodeStatus: "201"
};

const paymentLogData = {
  _airbyte_raw_id: "0199a75f-3b4a-7db0-b25d-46a7291a0973",
  _id: "68dbdf2729b0abcfd2c9b2bc",
  lfiId: "ADCBRT",
  psuId: "14207702",
  tppId: "0016920f-c806-47fd-91d6-ce81b3fa7a1e",
  amount: "15000.0",
  status: "AcceptedSettlementCompleted",
  lfiName: "uae-adcbrt",
  tppName: "PAY TEN PAYMENT SERVICES PROVIDER LLC",
  currency: "AED",
  paymentId: "4642f164-34cf-4a64-b0f7-bcd03b5943c4",
  timestamp: "2025-09-30T13:46:15.562Z",
  merchantId: "",
  paymentType: "Collection",
  tppClientId: "26f284b9-07c9-4e1d-949d-bfab04f37be5",
  isLargeCorporate: "",
  paymentConsentType: "VariableOnDemand",
  paymentPurposeCode: "OAT",
  internationalPayment: "False",
  numberOfSuccessfulTransactions: ""
};

// Merge the data as the service does
const mergedRecord = {
  jobId: "test-job-123",
  "raw_api_log_data.timestamp": rawApiLogData.timestamp,
  "raw_api_log_data.tpp_name": rawApiLogData.tppName,
  "raw_api_log_data.lfi_name": rawApiLogData.lfiName,
  "raw_api_log_data.lfi_id": rawApiLogData.lfiId,
  "raw_api_log_data.tpp_id": rawApiLogData.tppId,
  "raw_api_log_data.tpp_client_id": rawApiLogData.tppClientId,
  "raw_api_log_data.api_set_sub": rawApiLogData.apiSet,
  "raw_api_log_data.http_method": rawApiLogData.httpMethod,
  "raw_api_log_data.url": rawApiLogData.url,
  "raw_api_log_data.tpp_response_code_group": rawApiLogData.tppResponseCodeGroup,
  "raw_api_log_data.execution_time": rawApiLogData.executionTime,
  "raw_api_log_data.interaction_id": rawApiLogData.interactionId,
  "raw_api_log_data.resource_name": rawApiLogData.resourceName,
  "raw_api_log_data.lfi_response_code_group": rawApiLogData.lfIResponseCodeGroup,
  "raw_api_log_data.is_attended": rawApiLogData.isAttended === "TRUE" || rawApiLogData.isAttended === "true",
  "raw_api_log_data.records": rawApiLogData.records || null,
  "raw_api_log_data.payment_type": rawApiLogData.paymentType,
  "raw_api_log_data.payment_id": rawApiLogData.paymentId,
  "raw_api_log_data.merchant_id": rawApiLogData.merchantId || null,
  "raw_api_log_data.psu_id": rawApiLogData.psuId,
  "raw_api_log_data.is_large_corporate": rawApiLogData.isLargeCorporate === "TRUE" || rawApiLogData.isLargeCorporate === "true",
  "raw_api_log_data.user_type": rawApiLogData.userType || null,
  "raw_api_log_data.purpose": rawApiLogData.purpose || null,

  "payment_logs.timestamp": paymentLogData.timestamp,
  "payment_logs.tpp_name": paymentLogData.tppName,
  "payment_logs.lfi_name": paymentLogData.lfiName,
  "payment_logs.lfi_id": paymentLogData.lfiId,
  "payment_logs.tpp_id": paymentLogData.tppId,
  "payment_logs.tpp_client_id": paymentLogData.tppClientId,
  "payment_logs.status": paymentLogData.status,
  "payment_logs.currency": paymentLogData.currency,
  "payment_logs.amount": paymentLogData.amount,
  "payment_logs.payment_consent_type": paymentLogData.paymentConsentType,
  "payment_logs.payment_type": paymentLogData.paymentType,
  "payment_logs.transaction_id": paymentLogData.transactionId || null,
  "payment_logs.payment_id": paymentLogData.paymentId,
  "payment_logs.merchant_id": paymentLogData.merchantId || null,
  "payment_logs.psu_id": paymentLogData.psuId,
  "payment_logs.is_large_corporate": paymentLogData.isLargeCorporate === "TRUE" || paymentLogData.isLargeCorporate === "true",
  "payment_logs.number_of_successful_transactions": paymentLogData.numberOfSuccessfulTransactions || null,
  "payment_logs.international_payment": paymentLogData.internationalPayment === 'TRUE',
};

console.log("=" .repeat(100));
console.log("🧪 TEST: Processing Your Actual CSV Data");
console.log("=".repeat(100));
console.log("\n📋 Raw API Log Record:");
console.log(JSON.stringify(rawApiLogData, null, 2));
console.log("\n📋 Payment Log Record:");
console.log(JSON.stringify(paymentLogData, null, 2));
console.log("\n📋 Merged Record (as processed by service):");
console.log(JSON.stringify(mergedRecord, null, 2));
console.log("\n" + "=".repeat(100));

// Database connection and test execution
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://193.123.81.148:27017/billing';

async function runTest() {
  try {
    console.log("\n🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Import models
    const ApiData = mongoose.model('api_data', new mongoose.Schema({
      api_endpoint: String,
      api_operation: String,
      chargeable_api_hub_fee: Boolean,
      chargeable_LFI_TPP_fee: Boolean,
      chargeable_quote_fee: Boolean,
      key_name: String,
      api_category: String,
      commission_category: String,
    }), 'api_data');

    const GlobalConfig = mongoose.model('global_configuration', new mongoose.Schema({
      key: String,
      value: mongoose.Schema.Types.Mixed,
    }), 'global_configuration');

    // Fetch API configurations
    console.log("📡 Fetching API configurations...");
    const apiData = await ApiData.find({
      $or: [
        { chargeable_api_hub_fee: true },
        { chargeable_LFI_TPP_fee: true },
        { chargeable_quote_fee: true },
      ]
    }).lean();
    console.log(`✅ Found ${apiData.length} API configurations\n`);

    // Fetch global configurations
    console.log("⚙️  Fetching global configurations...");
    const globalConfigs = await GlobalConfig.find().lean();
    console.log(`✅ Found ${globalConfigs.length} global configurations\n`);

    // Create variables object
    const variables = {};
    globalConfigs.forEach(config => {
      variables[config.key] = config;
    });

    console.log("📊 Key Configuration Values:");
    console.log(`  - paymentApiHubFee: ${variables.paymentApiHubFee?.value}`);
    console.log(`  - paymentLargeValueFee: ${variables.paymentLargeValueFee?.value}`);
    console.log(`  - nonLargeValueMerchantBps: ${variables.nonLargeValueMerchantBps?.value}`);
    console.log(`  - nonLargeValueCapMerchant: ${variables.nonLargeValueCapMerchant?.value}`);
    console.log(`  - nonLargeValueFreeLimitMerchant: ${variables.nonLargeValueFreeLimitMerchant?.value}`);
    
    const paymentStatus = ['AcceptedSettlementCompleted', 'AcceptedCreditSettlementCompleted', 'AcceptedWithoutPosting'];
    const paymentTypesForMerchant = ['Collection', 'LargeValueCollection'];
    const peerToPeerTypes = ['PushP2P', 'PullP2P'];

    console.log("\n" + "=".repeat(100));
    console.log("🔍 STEP 1: Determine Chargeable and Success");
    console.log("=".repeat(100));

    // Helper functions
    function matchTemplateVersionUrl(url) {
      const versionRegex = /\/v\d+\.\d+/;
      const parts = url.split(versionRegex);
      return parts[1] || '';
    }

    function matchTemplateUrl(template, url) {
      // Simple template matching - replace {id} with regex pattern
      const templateRegex = template.replace(/\{[^}]+\}/g, '[^/]+');
      const regex = new RegExp(`^${templateRegex}$`);
      return regex.test(url);
    }

    // Check chargeable flags
    const rawDataEndpoint = matchTemplateVersionUrl(mergedRecord["raw_api_log_data.url"]);
    const rawDataMethod = mergedRecord["raw_api_log_data.http_method"];

    console.log(`\n📌 Record Details:`);
    console.log(`  Full URL: ${mergedRecord["raw_api_log_data.url"]}`);
    console.log(`  Endpoint (after version removal): ${rawDataEndpoint}`);
    console.log(`  HTTP Method: ${rawDataMethod}`);
    console.log(`  Payment ID: ${mergedRecord["raw_api_log_data.payment_id"]}`);
    console.log(`  TPP Response Code: ${mergedRecord["raw_api_log_data.tpp_response_code_group"]}`);
    console.log(`  LFI Response Code: ${mergedRecord["raw_api_log_data.lfi_response_code_group"]}`);

    // Check if chargeable
    const chargableUrls = apiData
      .filter(api => api.chargeable_api_hub_fee === true)
      .map(api => ({ endpoint: api.api_endpoint, method: api.api_operation.toUpperCase() }));

    const lfiChargableUrls = apiData
      .filter(api => api.chargeable_LFI_TPP_fee === true)
      .map(api => ({ endpoint: api.api_endpoint, method: api.api_operation.toUpperCase() }));

    console.log(`\n🔎 Checking against ${chargableUrls.length} API Hub chargeable URLs...`);
    console.log(`🔎 Checking against ${lfiChargableUrls.length} LFI/TPP chargeable URLs...`);

    let isChargeable = false;
    let islfiChargable = false;

    for (const api of chargableUrls) {
      const urlMatch = matchTemplateUrl(api.endpoint, rawDataEndpoint);
      const methodMatch = api.method.toUpperCase() === rawDataMethod.toUpperCase();
      console.log(`  📍 Checking: ${api.endpoint} (${api.method}) - URL Match: ${urlMatch}, Method Match: ${methodMatch}`);
      if (urlMatch && methodMatch) {
        isChargeable = true;
        break;
      }
    }

    for (const api of lfiChargableUrls) {
      const urlMatch = matchTemplateUrl(api.endpoint, rawDataEndpoint);
      const methodMatch = api.method.toUpperCase() === rawDataMethod.toUpperCase();
      console.log(`  📍 Checking: ${api.endpoint} (${api.method}) - URL Match: ${urlMatch}, Method Match: ${methodMatch}`);
      if (urlMatch && methodMatch) {
        islfiChargable = true;
        break;
      }
    }

    const success = /^2([a-zA-Z0-9]{2}|\d{2})$/.test(mergedRecord["raw_api_log_data.tpp_response_code_group"]);

    console.log(`\n✅ Chargeable Flags:`);
    console.log(`  - isChargeable (API Hub): ${isChargeable}`);
    console.log(`  - islfiChargable (LFI/TPP): ${islfiChargable}`);
    console.log(`  - success (based on response code): ${success}`);

    // Add flags to record
    mergedRecord.chargeable = isChargeable;
    mergedRecord.lfiChargable = islfiChargable;
    mergedRecord.success = success;

    console.log("\n" + "=".repeat(100));
    console.log("💰 STEP 2: Calculate API Hub Fee and Determine Group");
    console.log("=".repeat(100));

    // Find group data
    function findGroupData(record, apiData) {
      const endPointurl = matchTemplateVersionUrl(record["raw_api_log_data.url"]);
      const httpMethod = record["raw_api_log_data.http_method"];

      for (const api of apiData) {
        const isUrlMatch = matchTemplateUrl(api.api_endpoint, endPointurl);
        if (isUrlMatch && api.api_operation.toUpperCase() === httpMethod.toUpperCase()) {
          return api;
        }
      }
      return null;
    }

    const groupData = findGroupData(mergedRecord, apiData);
    let group = groupData?.key_name || "Other";

    console.log(`\n📊 Group Data Found:`);
    console.log(`  - key_name: ${groupData?.key_name}`);
    console.log(`  - api_category: ${groupData?.api_category}`);
    console.log(`  - commission_category: ${groupData?.commission_category}`);
    console.log(`  - assigned group: ${group}`);

    // Check payment status validation
    console.log(`\n🔍 Payment Status Validation:`);
    console.log(`  - record.success (before): ${mergedRecord.success}`);
    console.log(`  - payment_logs.status: ${mergedRecord['payment_logs.status']}`);
    console.log(`  - Is payment group: ${groupData?.key_name === 'payment-bulk' || groupData?.key_name === 'payment-non-bulk' || groupData?.key_name === 'payment-data'}`);

    if (mergedRecord.success && (groupData?.key_name === 'payment-bulk' || groupData?.key_name === 'payment-non-bulk' || groupData?.key_name === 'payment-data')) {
      const oldSuccess = mergedRecord.success;
      mergedRecord.success = paymentStatus.includes(mergedRecord['payment_logs.status']);
      console.log(`  - Valid payment statuses: ${JSON.stringify(paymentStatus)}`);
      console.log(`  - Status in valid list: ${paymentStatus.includes(mergedRecord['payment_logs.status'])}`);
      console.log(`  - record.success (after): ${mergedRecord.success} (changed from ${oldSuccess})`);
    }

    // Determine type
    function getType(logEntry) {
      let type = "NA";
      if (logEntry["payment_logs.merchant_id"] != null || paymentTypesForMerchant.includes(logEntry["raw_api_log_data.payment_type"])) {
        type = "merchant";
      } else if (peerToPeerTypes.includes(logEntry["raw_api_log_data.payment_type"])) {
        type = "peer-2-peer";
      } else if (logEntry["raw_api_log_data.payment_type"] == "Me2Me") {
        type = "me-2-me";
      }
      return type;
    }

    let calculatedType;
    if (groupData?.key_name === 'payment-bulk' || groupData?.key_name === 'payment-non-bulk') {
      calculatedType = getType(mergedRecord);
      console.log(`\n🎯 Type Calculation (payment group):`);
      console.log(`  - merchant_id: ${mergedRecord["payment_logs.merchant_id"]}`);
      console.log(`  - payment_type: ${mergedRecord["raw_api_log_data.payment_type"]}`);
      console.log(`  - paymentTypesForMerchant: ${JSON.stringify(paymentTypesForMerchant)}`);
      console.log(`  - peerToPeerTypes: ${JSON.stringify(peerToPeerTypes)}`);
      console.log(`  - Calculated type: ${calculatedType}`);
    } else {
      calculatedType = 'NA';
      console.log(`\n🎯 Type defaulted to 'NA'`);
    }

    mergedRecord.group = group;
    mergedRecord.type = calculatedType;

    console.log(`\n🏁 Final values after API Hub Fee calculation:`);
    console.log(`  - group: ${group}`);
    console.log(`  - type: ${calculatedType}`);
    console.log(`  - chargeable: ${mergedRecord.chargeable}`);
    console.log(`  - lfiChargable: ${mergedRecord.lfiChargable}`);
    console.log(`  - success: ${mergedRecord.success}`);

    console.log("\n" + "=".repeat(100));
    console.log("💵 STEP 3: Calculate LFI/TPP Fee");
    console.log("=".repeat(100));

    let calculatedFee = 0;
    let applicableFee = 0;
    let unit_price = 0;
    let volume = 0;

    console.log(`\n📌 Checking Fee Calculation Conditions:`);
    console.log(`  - lfiChargable: ${mergedRecord.lfiChargable} (required: true)`);
    console.log(`  - success: ${mergedRecord.success} (required: true)`);
    console.log(`  - Can calculate fee: ${mergedRecord.lfiChargable && mergedRecord.success}`);

    if (mergedRecord.lfiChargable && mergedRecord.success) {
      console.log(`\n✅ Proceeding with fee calculation`);
      console.log(`\n📊 Record Details for Fee Calculation:`);
      console.log(`  - group: ${mergedRecord.group}`);
      console.log(`  - type: ${mergedRecord.type}`);
      console.log(`  - is_large_corporate: ${mergedRecord['raw_api_log_data.is_large_corporate']}`);
      console.log(`  - payment_type: ${mergedRecord['raw_api_log_data.payment_type']}`);
      console.log(`  - merchant_id: ${mergedRecord['payment_logs.merchant_id']}`);
      console.log(`  - amount: ${mergedRecord['payment_logs.amount']}`);

      if (mergedRecord.type === "merchant") {
        console.log(`\n🏪 Merchant Calculation Path`);
        console.log(`  - payment_type: ${mergedRecord["raw_api_log_data.payment_type"]}`);
        console.log(`  - Is LargeValueCollection: ${mergedRecord["raw_api_log_data.payment_type"] === 'LargeValueCollection'}`);

        if (mergedRecord["raw_api_log_data.payment_type"] === 'LargeValueCollection') {
          console.log(`  - Processing as LargeValueCollection`);
          if (mergedRecord.group == 'payment-non-bulk') {
            console.log(`  - Group: payment-non-bulk`);
            calculatedFee = variables.paymentLargeValueFee?.value || 0;
            applicableFee = calculatedFee;
            unit_price = variables.paymentLargeValueFee?.value || 0;
            volume = 1;
            console.log(`  - Fee: ${calculatedFee}, Unit Price: ${unit_price}, Volume: ${volume}`);
          }
        } else {
          console.log(`  - Processing as regular Collection (non-LargeValueCollection)`);
          console.log(`  - merchant_id is: ${mergedRecord["payment_logs.merchant_id"] ? 'PRESENT' : 'EMPTY/NULL'}`);
          console.log(`  - Since merchant_id is empty, this should be treated as NON-MERCHANT payment`);
          console.log(`  ⚠️ BUT type was calculated as 'merchant' because payment_type='Collection' is in paymentTypesForMerchant list`);
          console.log(`  ⚠️ This is the ISSUE: Collection without merchant_id should NOT be treated as merchant!`);
          
          // Without merchant_id, can't do merchant calculations
          console.log(`  - No merchant calculations can be performed without merchant_id`);
          console.log(`  - Fees will remain 0`);
        }
      } else {
        console.log(`\n⚠️ Type is '${mergedRecord.type}', not 'merchant' - no fee calculation path matches`);
      }
    } else {
      console.log(`\n❌ Fee calculation skipped - Conditions not met`);
      console.log(`  - lfiChargable: ${mergedRecord.lfiChargable} (required: true)`);
      console.log(`  - success: ${mergedRecord.success} (required: true)`);
    }

    console.log(`\n🏁 Final Fee Calculation Results:`);
    console.log(`  - calculatedFee: ${calculatedFee}`);
    console.log(`  - applicableFee: ${applicableFee}`);
    console.log(`  - unit_price: ${unit_price}`);
    console.log(`  - volume: ${volume}`);

    console.log("\n" + "=".repeat(100));
    console.log("🎯 ROOT CAUSE ANALYSIS");
    console.log("=".repeat(100));
    
    console.log(`\n🔴 ISSUE IDENTIFIED:`);
    console.log(`\nThe problem is in the getType() function logic:`);
    console.log(`\n  if (logEntry["payment_logs.merchant_id"] != null || paymentTypesForMerchant.includes(logEntry["raw_api_log_data.payment_type"])) {`);
    console.log(`    type = "merchant";`);
    console.log(`  }`);
    console.log(`\nYour data:`);
    console.log(`  - merchant_id: "${mergedRecord["payment_logs.merchant_id"]}" (empty string, but != null, so it's falsy but not null)`);
    console.log(`  - payment_type: "${mergedRecord["raw_api_log_data.payment_type"]}"`);
    console.log(`  - paymentTypesForMerchant includes "Collection": ${paymentTypesForMerchant.includes(mergedRecord["raw_api_log_data.payment_type"])}`);
    console.log(`\nBecause "Collection" is in paymentTypesForMerchant, type is set to "merchant"`);
    console.log(`BUT merchant_id is empty, so the merchant fee calculation logic cannot proceed.`);
    console.log(`\n💡 The code needs to check if merchant_id is NOT EMPTY, not just != null`);
    console.log(`   OR the payment should be classified differently when merchant_id is missing`);

  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

runTest();
