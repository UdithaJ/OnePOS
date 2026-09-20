// Previews and applies a validated upgrade script.
//
// Operations go straight to the driver rather than through a Mongoose model:
// an upgrade may touch any collection, including ones with no model, and it
// must write exactly what the script says without schema defaults or casting
// quietly changing it.
//
// There are no transactions here — this runs against a standalone mongod, not a
// replica set — so an upgrade that fails partway leaves the operations before
// it applied. That is why apply() reports each operation separately and records
// what actually happened rather than a single pass/fail.

const mongoose = require('mongoose');
const { validateScript, UPDATE_OPS, DELETE_OPS, INSERT_OPS } = require('./validate');

const SAMPLE_LIMIT = 3;

function db() {
  const conn = mongoose.connection;
  if (!conn || conn.readyState !== 1) {
    const err = new Error('The database is not connected.');
    err.status = 503;
    throw err;
  }
  return conn.db;
}

function describe(operation) {
  if (INSERT_OPS.includes(operation.op)) {
    const n = operation.op === 'insertOne' ? 1 : operation.documents.length;
    return `insert ${n} document(s) into ${operation.collection}`;
  }
  if (UPDATE_OPS.includes(operation.op)) {
    return `${operation.op === 'updateOne' ? 'update one' : 'update every'} matching document in ${operation.collection}`;
  }
  return `${operation.op === 'deleteOne' ? 'delete one' : 'delete every'} matching document in ${operation.collection}`;
}

// What each operation would do, without writing anything. Counts come from the
// same filters the apply would use, and a few affected documents are returned
// so the person approving it can see what is actually being targeted.
async function preview(rawScript) {
  const script = validateScript(rawScript);
  const database = db();
  const operations = [];

  for (const operation of script.operations) {
    const collection = database.collection(operation.collection);
    const row = {
      op: operation.op,
      collection: operation.collection,
      summary: describe(operation),
      matched: 0,
      willInsert: 0,
      sample: [],
      note: '',
    };

    if (INSERT_OPS.includes(operation.op)) {
      const docs = operation.op === 'insertOne' ? [operation.document] : operation.documents;
      row.willInsert = docs.length;
      row.sample = docs.slice(0, SAMPLE_LIMIT);
      // An insert is not filtered, so nothing existing is at risk.
      row.note = 'adds new documents; nothing existing is changed';
    } else {
      row.matched = await collection.countDocuments(operation.filter);
      row.sample = await collection.find(operation.filter).limit(SAMPLE_LIMIT).toArray();
      if (UPDATE_OPS.includes(operation.op)) {
        row.update = operation.update;
        if (operation.op === 'updateOne' && row.matched > 1) {
          row.note = `${row.matched} documents match but updateOne changes only the first`;
        }
      }
      if (DELETE_OPS.includes(operation.op) && row.matched > 0) {
        row.note = `${row.matched} document(s) would be permanently removed; there is no undo`;
      }
      if (row.matched === 0) {
        row.note = 'nothing matches this filter — the operation would do nothing';
      }
    }

    operations.push(row);
  }

  return { action: script.action, version: script.version, description: script.description, operations };
}

// Runs the operations in order. Each result records what the database reported,
// so a partial application is visible rather than implied.
async function apply(rawScript) {
  const script = validateScript(rawScript);
  const database = db();
  const results = [];

  for (const operation of script.operations) {
    const collection = database.collection(operation.collection);
    const startedAt = Date.now();
    try {
      let outcome;
      switch (operation.op) {
        case 'insertOne': {
          const r = await collection.insertOne(operation.document);
          outcome = { inserted: r.insertedId ? 1 : 0 };
          break;
        }
        case 'insertMany': {
          const r = await collection.insertMany(operation.documents);
          outcome = { inserted: r.insertedCount };
          break;
        }
        case 'updateOne': {
          const r = await collection.updateOne(operation.filter, operation.update);
          outcome = { matched: r.matchedCount, modified: r.modifiedCount };
          break;
        }
        case 'updateMany': {
          const r = await collection.updateMany(operation.filter, operation.update);
          outcome = { matched: r.matchedCount, modified: r.modifiedCount };
          break;
        }
        case 'deleteOne': {
          const r = await collection.deleteOne(operation.filter);
          outcome = { deleted: r.deletedCount };
          break;
        }
        case 'deleteMany': {
          const r = await collection.deleteMany(operation.filter);
          outcome = { deleted: r.deletedCount };
          break;
        }
        default:
          throw new Error(`unsupported op "${operation.op}"`);
      }
      results.push({
        op: operation.op,
        collection: operation.collection,
        status: 'applied',
        ...outcome,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      results.push({
        op: operation.op,
        collection: operation.collection,
        status: 'failed',
        error: err.message,
        durationMs: Date.now() - startedAt,
      });
      // Stop at the first failure: later operations usually assume the earlier
      // ones landed, and running them against a half-applied state is worse
      // than stopping. What already ran stays — there is no transaction.
      break;
    }
  }

  return { action: script.action, version: script.version, results };
}

module.exports = { preview, apply, describe };
