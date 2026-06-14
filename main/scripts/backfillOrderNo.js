// Backfill script to assign sequential orderNo to existing orders
// Usage: node main/scripts/backfillOrderNo.js

const mongoose = require('mongoose');
const path = require('path');

// Load environment or default Mongo URL
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/onepos';

async function main() {
  console.log('Connecting to', MONGO_URL);
  await mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

  // require models after connecting
  const Order = require('../models/order');

  try {
    // Find all orders sorted by creation date (oldest first)
    const orders = await Order.find().sort({ createdDate: 1 }).select('_id orderNo createdDate').lean();
    console.log(`Found ${orders.length} orders`);

    let next = 1;
    // If any existing order already has orderNo, start after the max
    const withOrderNo = orders.filter(o => o.orderNo && Number.isFinite(o.orderNo));
    if (withOrderNo.length > 0) {
      const max = Math.max(...withOrderNo.map(o => Number(o.orderNo)));
      next = max + 1;
      console.log(`Existing max orderNo ${max}, starting next at ${next}`);
    }

    let updated = 0;
    for (const o of orders) {
      if (!o.orderNo || !Number.isFinite(Number(o.orderNo))) {
        await Order.findByIdAndUpdate(o._id, { orderNo: next }, { new: true });
        if (next % 100 === 0) console.log(`Assigned orderNo ${next} to ${o._id}`);
        next += 1;
        updated += 1;
      }
    }

    console.log(`Backfill complete. Assigned ${updated} new orderNo values.`);
  } catch (err) {
    console.error('Backfill failed', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
