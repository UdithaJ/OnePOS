// Reports customers that share a mobile number, and optionally adds the unique
// index that stops new ones appearing.
//
// The application already rejects duplicate mobile numbers (see
// customer.service.js). The unique index closes the remaining gap: two
// concurrent requests can both pass the application check before either saves.
// It is applied by this script rather than declared on the schema because a
// build against a collection that already holds duplicates fails at startup,
// which would leave the enforcement silently absent.
//
// Usage: node main/scripts/checkDuplicateCustomerMobiles.js
//        node main/scripts/checkDuplicateCustomerMobiles.js --create-index

const mongoose = require('mongoose');
const path = require('path');

// MONGO_URI is the name server.js uses, so the script follows the same .env
// the app does — connecting anywhere else would check the wrong database and
// report a clean bill of health for it.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const MONGO_URL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
const CREATE_INDEX = process.argv.includes('--create-index');

async function main() {
  if (!MONGO_URL) {
    console.error('No MONGO_URI found. Set it in .env or pass it in the environment.');
    process.exitCode = 1;
    return;
  }

  console.log('Connecting to', MONGO_URL);
  await mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Database:', mongoose.connection.name);

  const Customer = require('../models/customer');

  try {
    const duplicates = await Customer.aggregate([
      { $match: { mobileNumber: { $nin: [null, ''] } } },
      { $group: { _id: '$mobileNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]);

    if (duplicates.length === 0) {
      console.log('No duplicate mobile numbers found.');
    } else {
      console.log(`Found ${duplicates.length} mobile number(s) shared by more than one customer:`);
      for (const d of duplicates) {
        console.log(`  ${d._id} — ${d.count} customers: ${d.ids.join(', ')}`);
      }
    }

    if (!CREATE_INDEX) {
      console.log('\nRe-run with --create-index to add the unique index once the list above is empty.');
      return;
    }

    if (duplicates.length > 0) {
      console.error('\nRefusing to create the unique index while duplicates exist. Merge or remove them first.');
      process.exitCode = 1;
      return;
    }

    await Customer.collection.createIndex({ mobileNumber: 1 }, { unique: true, name: 'mobileNumber_unique' });
    console.log('\nCreated unique index mobileNumber_unique on customers.mobileNumber.');
  } catch (err) {
    console.error('Check failed', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
