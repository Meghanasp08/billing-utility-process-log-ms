const { MongoClient } = require('mongodb');
const uri = 'mongodb://mongoadmin:rC9!*%24L!Ku6pSSWx@193.123.81.148:27017/billing?authSource=admin';

async function checkDuplicateIssue() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('billing');
    const interactionId = 'e00af92e-37f5-4719-a193-60ea4b9b585c';
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('CHECKING DUPLICATE ISSUE FOR INTERACTION ID');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n🔍 Interaction ID:', interactionId);
    
    // Count records with this interaction_id
    const count = await db.collection('logs').countDocuments({
      'raw_api_log_data.interaction_id': interactionId
    });
    console.log('\n📊 Total records with this interaction_id:', count);
    
    // Get all records with this interaction_id
    const records = await db.collection('logs').find({
      'raw_api_log_data.interaction_id': interactionId
    }).project({
      _id: 1,
      duplicate: 1,
      chargeable: 1,
      success: 1,
      'raw_api_log_data.timestamp': 1,
      'raw_api_log_data.tpp_name': 1,
      createdAt: 1
    }).toArray();
    
    console.log('\n📋 Records found:');
    records.forEach((rec, idx) => {
      console.log(`\n  Record #${idx + 1}:`);
      console.log('    _id:', rec._id);
      console.log('    duplicate:', rec.duplicate);
      console.log('    chargeable:', rec.chargeable);
      console.log('    success:', rec.success);
      console.log('    timestamp:', rec.raw_api_log_data?.timestamp);
      console.log('    tpp_name:', rec.raw_api_log_data?.tpp_name);
      console.log('    createdAt:', rec.createdAt);
    });
    
    // Check invoice generation eligibility
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('INVOICE ELIGIBILITY CHECK');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const eligibleCount = await db.collection('logs').countDocuments({
      'raw_api_log_data.interaction_id': interactionId,
      chargeable: true,
      success: true,
      duplicate: false
    });
    
    console.log('\n✅ Records eligible for invoice (duplicate: false):', eligibleCount);
    console.log('❌ Records NOT eligible (duplicate: true):', count - eligibleCount);
    
    if (eligibleCount === 0 && count > 0) {
      console.log('\n⚠️  PROBLEM IDENTIFIED:');
      console.log('   All records are marked as duplicate: true');
      console.log('   Invoice generation will skip these records!');
      
      console.log('\n🔧 SOLUTION OPTIONS:');
      console.log('   1. Delete duplicate records and re-upload');
      console.log('   2. Update duplicate flag to false for the latest record');
      console.log('   3. Delete all records with this interaction_id and re-upload fresh');
    }
    
    // Show fix command
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('FIX OPTIONS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    console.log('\n📝 Option 1: Delete ALL records with this interaction_id:');
    console.log('   Run: node fix-duplicate.js delete');
    
    console.log('\n📝 Option 2: Set duplicate=false for the LATEST record:');
    console.log('   Run: node fix-duplicate.js fix');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkDuplicateIssue();
