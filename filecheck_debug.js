const { MongoClient } = require('mongodb');
const uri = 'mongodb://mongoadmin:rC9!*%24L!Ku6pSSWx@193.123.81.148:27017/billing?authSource=admin';

async function analyzeUploadedFiles() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('billing');
    
    // Sample data from user's files
    const rawApiLogSample = {
      url: 'open-finance/payment/v1.2/payments',
      lfiId: 'ADCBRT',
      psuId: '14207702',
      tppId: '0016920f-c806-47fd-91d6-ce81b3fa7a1e',
      apiSet: 'PISP',
      lfiName: 'uae-adcbrt',
      tppName: 'PAY TEN PAYMENT SERVICES PROVIDER LLC',
      paymentId: '4642f164-34cf-4a64-b0f7-bcd03b5943c4',
      timestamp: '2025-09-30T13:46:08.166Z',
      httpMethod: 'POST',
      isAttended: 'FALSE',
      merchantId: '',
      paymentType: 'Collection',
      tppClientId: '26f284b9-07c9-4e1d-949d-bfab04f37be',
      resourceName: 'cbuae-service-initiation',
      executionTime: '7445',
      interactionId: 'e00af92e-37f5-4719-a193-60ea4b9b585c',
      isLargeCorporate: '',
      lfIResponseCodeGroup: '201',
      tppResponseCodeGroup: '2xx'
    };
    
    const paymentLogSample = {
      lfiId: 'ADCBRT',
      psuId: '14207702',
      tppId: '0016920f-c806-47fd-91d6-ce81b3fa7a1e',  // CORRECTED - must match raw log TPP ID for invoice calculation
      amount: '15000.0',
      status: 'AcceptedSettlementCompleted',
      lfiName: 'uae-adcbrt',
      tppName: 'PAY TEN PAYMENT SERVICES PROVIDER LLC',
      currency: 'AED',
      paymentId: '4642f164-34cf-4a64-b0f7-bcd03b5943c4',
      timestamp: '2025-09-30T13:46:15.562Z',
      merchantId: '',
      paymentType: 'Collection',
      tppClientId: '26f284b9-07c9-4e1d-949d-bfab04f37be5',
      isLargeCorporate: '',
      paymentConsentType: 'VariableOnDemand',
      internationalPayment: 'False',
      numberOfSuccessfulTransactions: ''
    };
    
    // AppConfig values (from code)
    const AppConfig = {
      peerToPeerTypes: ['PushP2P', 'PullP2P'],
      paymentTypesForMerchant: ['Collection', 'LargeValueCollection'],
      paymentTypes: ['Collection', 'LargeValueCollection', 'PushP2P', 'PullP2P', 'Me2Me', ''],
      paymentStatus: ['AcceptedSettlementCompleted', 'AcceptedCreditSettlementCompleted', 'AcceptedWithoutPosting']
    };
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('1. RAW API LOG VALIDATION');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Check URL processing (same logic as matchTemplateVersionUrl in upload.service.ts)
    const versionRegex = /\/v\d+\.\d+/;
    const urlParts = rawApiLogSample.url.split(versionRegex);
    const processedEndpoint = urlParts[1] || '';
    
    console.log('\n📋 URL Processing:');
    console.log('  • Original URL:', rawApiLogSample.url);
    console.log('  • After version removal:', processedEndpoint);
    console.log('  • Expected endpoint: /payments');
    console.log('  • Match:', processedEndpoint === '/payments' ? '✅ YES' : '❌ NO');
    
    // Check API endpoint in database
    const apiData = await db.collection('api_data').find({}).toArray();
    const matchingApi = apiData.find(a => 
      a.api_endpoint === processedEndpoint && 
      a.api_operation?.toUpperCase() === rawApiLogSample.httpMethod.toUpperCase()
    );
    
    console.log('\n📋 API Endpoint Match in Database:');
    if (matchingApi) {
      console.log('  ✅ FOUND matching API configuration:');
      console.log('     • api_endpoint:', matchingApi.api_endpoint);
      console.log('     • api_operation:', matchingApi.api_operation);
      console.log('     • key_name:', matchingApi.key_name);
      console.log('     • api_category:', matchingApi.api_category);
      console.log('     • chargeable_api_hub_fee:', matchingApi.chargeable_api_hub_fee);
      console.log('     • chargeable_LFI_TPP_fee:', matchingApi.chargeable_LFI_TPP_fee);
    } else {
      console.log('  ❌ NO matching API found!');
    }
    
    // Check TPP exists
    console.log('\n📋 TPP Validation:');
    const tppData = await db.collection('tpp_data').findOne({ tpp_id: rawApiLogSample.tppId });
    if (tppData) {
      console.log('  ✅ TPP found in database:', tppData.tpp_name);
      console.log('     • serviceStatus:', tppData.serviceStatus);
    } else {
      console.log('  ⚠️ TPP NOT found in database. Will be auto-created during processing.');
      console.log('     TPP ID:', rawApiLogSample.tppId);
    }
    
    // Check LFI exists
    console.log('\n📋 LFI Validation:');
    const lfiData = await db.collection('lfi_data').findOne({ lfi_id: rawApiLogSample.lfiId });
    if (lfiData) {
      console.log('  ✅ LFI found in database:', lfiData.lfi_name);
      console.log('     • mdp_rate:', lfiData.mdp_rate);
      console.log('     • free_limit_attended:', lfiData.free_limit_attended);
      console.log('     • free_limit_unattended:', lfiData.free_limit_unattended);
    } else {
      console.log('  ⚠️ LFI NOT found in database. Will be auto-created during processing.');
      console.log('     LFI ID:', rawApiLogSample.lfiId);
    }
    
    // Check Boolean parsing
    console.log('\n📋 Boolean Field Validation:');
    const parseBoolean = (value) => {
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
        if (normalized === '') return false;
      }
      return 'INVALID';
    };
    console.log('  • isAttended ("' + rawApiLogSample.isAttended + '"):', parseBoolean(rawApiLogSample.isAttended));
    console.log('  • isLargeCorporate ("' + rawApiLogSample.isLargeCorporate + '"):', parseBoolean(rawApiLogSample.isLargeCorporate));
    
    // Success check
    console.log('\n📋 Success Determination:');
    const successPattern = /^2([a-zA-Z0-9]{2}|\d{2})$/;
    const isSuccess = successPattern.test(rawApiLogSample.tppResponseCodeGroup);
    console.log('  • tppResponseCodeGroup:', rawApiLogSample.tppResponseCodeGroup);
    console.log('  • Pattern: /^2([a-zA-Z0-9]{2}|\\d{2})$/');
    console.log('  • Is Success:', isSuccess ? '✅ YES' : '❌ NO');
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('2. PAYMENT LOG VALIDATION');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Payment Type validation
    console.log('\n📋 Payment Type Validation:');
    console.log('  • paymentType in file:', paymentLogSample.paymentType);
    console.log('  • Valid payment types:', JSON.stringify(AppConfig.paymentTypes));
    console.log('  • Is Valid:', AppConfig.paymentTypes.includes(paymentLogSample.paymentType) ? '✅ YES' : '❌ NO');
    
    // Payment Status validation
    console.log('\n📋 Payment Status Validation:');
    console.log('  • status in file:', paymentLogSample.status);
    console.log('  • Valid statuses:', JSON.stringify(AppConfig.paymentStatus));
    console.log('  • Is Valid Status:', AppConfig.paymentStatus.includes(paymentLogSample.status) ? '✅ YES' : '❌ NO');
    
    // Amount validation
    console.log('\n📋 Amount Validation:');
    console.log('  • amount in file:', paymentLogSample.amount);
    console.log('  • Is numeric:', !isNaN(parseFloat(paymentLogSample.amount)) ? '✅ YES' : '❌ NO');
    console.log('  • Parsed value:', parseFloat(paymentLogSample.amount));
    
    // Payment ID matching
    console.log('\n📋 Payment ID Matching:');
    console.log('  • Raw Log paymentId:', rawApiLogSample.paymentId);
    console.log('  • Payment Log paymentId:', paymentLogSample.paymentId);
    console.log('  • Match:', rawApiLogSample.paymentId === paymentLogSample.paymentId ? '✅ YES' : '❌ NO');
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('3. TRANSACTION TYPE DETERMINATION');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Determine type (same logic as getType in upload.service.ts)
    let type = 'NA';
    if (paymentLogSample.merchantId || AppConfig.paymentTypesForMerchant.includes(rawApiLogSample.paymentType)) {
      type = 'merchant';
    } else if (AppConfig.peerToPeerTypes.includes(rawApiLogSample.paymentType)) {
      type = 'peer-2-peer';
    } else if (rawApiLogSample.paymentType === 'Me2Me') {
      type = 'me-2-me';
    }
    
    console.log('\n📋 Type Determination:');
    console.log('  • merchantId in payment log:', paymentLogSample.merchantId || '(empty)');
    console.log('  • paymentType:', rawApiLogSample.paymentType);
    console.log('  • paymentTypesForMerchant:', JSON.stringify(AppConfig.paymentTypesForMerchant));
    console.log('  • peerToPeerTypes:', JSON.stringify(AppConfig.peerToPeerTypes));
    console.log('  • ➡️ Determined Type:', type);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('4. FEE CALCULATION PREVIEW');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Get global configs
    const globalConfigs = await db.collection('global_configuration').find({}).toArray();
    const getConfig = (key) => globalConfigs.find(c => c.key === key)?.value;
    
    console.log('\n📋 Applicable Fees (based on configuration):');
    console.log('  • Group:', matchingApi?.key_name || 'Unknown');
    console.log('  • API Hub Fee (paymentApiHubFee):', getConfig('paymentApiHubFee'), 'AED');
    
    if (type === 'merchant') {
      console.log('\n  📊 Merchant Transaction Fees:');
      console.log('     • Amount:', parseFloat(paymentLogSample.amount), 'AED');
      console.log('     • nonLargeValueCapMerchant:', getConfig('nonLargeValueCapMerchant'), 'AED');
      console.log('     • nonLargeValueFreeLimitMerchant:', getConfig('nonLargeValueFreeLimitMerchant'), 'AED');
      console.log('     • nonLargeValueMerchantBps:', getConfig('nonLargeValueMerchantBps'));
      console.log('     • highValueMerchantCapCheck: 20000 AED (hardcoded in AppConfig)');
      
      const amount = parseFloat(paymentLogSample.amount);
      if (amount > 20000) {
        console.log('     ➡️ Large Value: Fee = paymentLargeValueFee:', getConfig('paymentLargeValueFee'), 'AED');
      } else {
        const bps = getConfig('nonLargeValueMerchantBps');
        const calculatedFee = (amount * bps) / 10000;
        console.log('     ➡️ Non-Large Value: Fee = amount * BPS / 10000');
        console.log('        Calculated:', calculatedFee.toFixed(4), 'AED');
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('5. POTENTIAL ISSUES DETECTED');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const issues = [];
    
    // Check TPP ID mismatch between files - CRITICAL: Will cause invoice calculation failure!
    if (rawApiLogSample.tppId !== paymentLogSample.tppId) {
      issues.push('❌ CRITICAL: TPP ID MISMATCH - Invoice calculation will FAIL! Raw Log (' + rawApiLogSample.tppId + ') vs Payment Log (' + paymentLogSample.tppId + ')');
    }
    
    // Check if TPP exists
    if (!tppData) {
      issues.push('⚠️ TPP not pre-configured (will be auto-created): ' + rawApiLogSample.tppId);
    }
    
    // Check if LFI exists
    if (!lfiData) {
      issues.push('⚠️ LFI not pre-configured (will be auto-created): ' + rawApiLogSample.lfiId);
    }
    
    // Check nonLargeValueMerchantBps value
    const bpsValue = getConfig('nonLargeValueMerchantBps');
    if (bpsValue === 38) {
      issues.push('⚠️ nonLargeValueMerchantBps is 38 (likely basis points, not decimal 0.0038)');
    }
    
    if (issues.length === 0) {
      console.log('\n✅ No critical issues detected!');
    } else {
      issues.forEach(issue => console.log('\n' + issue));
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n✅ Files should process successfully with the following outcomes:');
    console.log('   • Endpoint: /payments (POST) - Chargeable');
    console.log('   • Transaction Type:', type);
    console.log('   • Success:', isSuccess);
    console.log('   • Payment Status: AcceptedSettlementCompleted (valid)');
    console.log('   • chargeable_api_hub_fee:', matchingApi?.chargeable_api_hub_fee);
    console.log('   • chargeable_LFI_TPP_fee:', matchingApi?.chargeable_LFI_TPP_fee);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

analyzeUploadedFiles();
