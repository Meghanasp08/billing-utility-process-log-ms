const { MongoClient } = require('mongodb');
const uri = 'mongodb://mongoadmin:rC9!*%24L!Ku6pSSWx@193.123.81.148:27017/billing?authSource=admin';

const action = process.argv[2]; // 'delete', 'fix', or 'delete-all-duplicates'

async function fixDuplicateIssue() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('billing');
    const interactionId = 'e00af92e-37f5-4719-a193-60ea4b9b585c';
    
    if (action === 'delete') {
      console.log('🗑️  Deleting ALL records with interaction_id:', interactionId);
      const result = await db.collection('logs').deleteMany({
        'raw_api_log_data.interaction_id': interactionId
      });
      console.log('✅ Deleted', result.deletedCount, 'records');
      console.log('\n📝 Now you can re-upload your file and it will NOT be marked as duplicate.');
      
    } else if (action === 'fix') {
      console.log('🔧 Setting duplicate=false for the LATEST record with this interaction_id');
      
      // Find the latest record by _id (ObjectId contains timestamp)
      const latestRecord = await db.collection('logs').findOne(
        { 'raw_api_log_data.interaction_id': interactionId },
        { sort: { _id: -1 } }
      );
      
      if (latestRecord) {
        const result = await db.collection('logs').updateOne(
          { _id: latestRecord._id },
          { $set: { duplicate: false } }
        );
        console.log('✅ Updated record:', latestRecord._id);
        console.log('   Modified:', result.modifiedCount, 'record(s)');
      }
      
    } else if (action === 'delete-all-duplicates') {
      console.log('🗑️  Deleting ALL records marked as duplicate=true in the entire database...');
      const result = await db.collection('logs').deleteMany({ duplicate: true });
      console.log('✅ Deleted', result.deletedCount, 'duplicate records');
      
    } else if (action === 'fix-your-record') {
      // Fix the specific record from the user's upload (September 30 timestamp)
      const recordId = '6944e54134f5538f217e284e';
      console.log('🔧 Setting duplicate=false for your specific record:', recordId);
      
      const result = await db.collection('logs').updateOne(
        { _id: new (require('mongodb').ObjectId)(recordId) },
        { $set: { duplicate: false } }
      );
      console.log('✅ Modified:', result.modifiedCount, 'record(s)');
      console.log('\n📝 Your record is now eligible for invoice generation!');
      
    } else if (action === 'check-september') {
      // Check for all September 2025 records
      console.log('🔍 Checking records for September 2025...');
      
      const septemberRecords = await db.collection('logs').countDocuments({
        'raw_api_log_data.timestamp': {
          $gte: new Date('2025-09-01'),
          $lt: new Date('2025-10-01')
        },
        chargeable: true,
        success: true,
        duplicate: false
      });
      
      console.log('📊 Eligible records for September 2025 invoice:', septemberRecords);
      
    } else {
      console.log('Usage: node fix-duplicate.js <action>');
      console.log('');
      console.log('Actions:');
      console.log('  delete              - Delete ALL records with the specific interaction_id');
      console.log('  fix                 - Set duplicate=false for the LATEST record');
      console.log('  fix-your-record     - Set duplicate=false for your Sept 30 record specifically');
      console.log('  delete-all-duplicates - Delete ALL duplicate records in entire database');
      console.log('  check-september     - Check eligible records for September 2025');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

fixDuplicateIssue();
