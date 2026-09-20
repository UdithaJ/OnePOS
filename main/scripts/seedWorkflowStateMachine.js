// Runs the same first-run seeding the application performs on startup, from a
// terminal — useful on a server install, or to inspect/repair an existing
// database without restarting the app.
//
// The application seeds itself when it starts (main/bootstrap/index.js), so
// this is not required for a packaged install and in fact cannot be used
// inside one: it resolves .env relative to itself, while a packaged build reads
// .env from process.resourcesPath.
//
// What gets seeded is defined by the files in main/install/, not by this
// script. --reset clears the stored rules and the ledger entries for them so
// the next run (here or at startup) reinstates the shipped rules.
//
// Usage: node main/scripts/seedWorkflowStateMachine.js
//        node main/scripts/seedWorkflowStateMachine.js --list
//        node main/scripts/seedWorkflowStateMachine.js --reset

const mongoose = require('mongoose');
const path = require('path');

// MONGO_URI is the name server.js uses, so the script follows the same .env the
// app does — connecting anywhere else would seed the wrong database.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const MONGO_URL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
const RESET = process.argv.includes('--reset');
const LIST_ONLY = process.argv.includes('--list');

function describe(row) {
  const who = row.roles && row.roles.length ? row.roles.join('/') : 'anyone';
  const conditions = row.guards && row.guards.length ? `, requires ${row.guards.join(' + ')}` : '';
  const off = row.enabled === false ? '  [disabled]' : '';
  return `  ${String(row.entity).padEnd(8)} ${String(row.from).padEnd(10)} -> ${String(row.to).padEnd(10)} ${who}${conditions}${off}`;
}

async function main() {
  if (!MONGO_URL) {
    console.error('No MONGO_URI found. Set it in .env or pass it in the environment.');
    process.exitCode = 1;
    return;
  }

  console.log('Connecting to', MONGO_URL);
  await mongoose.connect(MONGO_URL);
  console.log('Database:', mongoose.connection.name);

  const WorkflowStateMachine = require('../models/workflowStateMachine');
  const ApplicationLog = require('../models/applicationLog');
  const { runBootstrap } = require('../bootstrap');

  try {
    if (LIST_ONLY) {
      const rows = await WorkflowStateMachine.find().sort({ entity: 1, from: 1, to: 1 }).lean();
      console.log(rows.length ? `\n${rows.length} stored transition(s):` : '\nNothing stored — the built-in rules apply.');
      rows.forEach(r => console.log(describe(r)));
      const log = await ApplicationLog.find().sort({ runAt: 1 }).lean();
      console.log(`\n${log.length} ledger entr(ies):`);
      log.forEach(l => console.log(`  ${l.action} v${l.version}  ${l.status}  ${l.detail || ''}`));
      return;
    }

    if (RESET) {
      const removed = await WorkflowStateMachine.deleteMany({});
      // The ledger entry has to go too, or the seed considers itself done.
      const clearedLog = await ApplicationLog.deleteMany({ action: 'seed:workflowStateMachine' });
      console.log(`--reset: removed ${removed.deletedCount} transition(s) and ${clearedLog.deletedCount} ledger entr(ies).`);
    }

    const status = await runBootstrap();
    console.log('');
    status.steps.forEach(s => console.log(`  ${s.action} v${s.version}: ${s.status} — ${s.detail}`));

    const rows = await WorkflowStateMachine.find().sort({ entity: 1, from: 1, to: 1 }).lean();
    console.log(`\n${rows.length} transition(s) now stored:`);
    rows.forEach(r => console.log(describe(r)));
    console.log('\nAny (entity, from -> to) triple not listed above is not a permitted move.');
  } catch (err) {
    console.error('Seeding failed', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
