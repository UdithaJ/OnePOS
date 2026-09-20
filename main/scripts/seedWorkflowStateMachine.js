// Seeds the workflowStateMachine collection with the rules shipped in code.
//
// Today one entity has a machine — 'order', from DEFAULT_TRANSITIONS in
// main/workflow/orderWorkflow.js. Add an entry to MACHINES below when another
// entity gains one.
//
// Until this has run, nothing is stored and the application falls back to those
// same built-in rules — so seeding does not change behaviour, it makes the rules
// editable. This is a deploy step for each environment, alongside
// checkDuplicateCustomerMobiles.js.
//
// Idempotent: existing rows are left exactly as they are, so a re-run never
// overwrites a rule someone has changed. --reset restores the shipped rules.
//
// Usage: node main/scripts/seedWorkflowStateMachine.js
//        node main/scripts/seedWorkflowStateMachine.js --reset
//        node main/scripts/seedWorkflowStateMachine.js --list

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
  const orderWorkflow = require('../workflow/orderWorkflow');

  // Every entity that ships a state machine.
  const MACHINES = [
    { entity: orderWorkflow.ORDER_ENTITY, transitions: orderWorkflow.DEFAULT_TRANSITIONS },
  ];

  try {
    if (LIST_ONLY) {
      const rows = await WorkflowStateMachine.find().sort({ entity: 1, from: 1, to: 1 }).lean();
      console.log(rows.length ? `\n${rows.length} stored transition(s):` : '\nNothing stored — the built-in rules apply.');
      rows.forEach(r => console.log(describe(r)));
      return;
    }

    if (RESET) {
      const entities = MACHINES.map(m => m.entity);
      const { deletedCount } = await WorkflowStateMachine.deleteMany({ entity: { $in: entities } });
      console.log(`--reset: removed ${deletedCount} existing row(s) for ${entities.join(', ')}.`);
    }

    // Flatten each machine into one row per permitted move.
    const wanted = [];
    for (const { entity, transitions } of MACHINES) {
      for (const [from, targets] of Object.entries(transitions)) {
        for (const [to, rule] of Object.entries(targets)) {
          wanted.push({
            entity,
            from,
            to,
            roles: rule.roles && rule.roles.length ? rule.roles : undefined,
            guards: rule.guards || [],
            enabled: true,
          });
        }
      }
    }

    let inserted = 0;
    let kept = 0;
    for (const row of wanted) {
      const existing = await WorkflowStateMachine.findOne({
        entity: row.entity, from: row.from, to: row.to,
      });
      if (existing) {
        kept += 1;
        continue;
      }
      await WorkflowStateMachine.create(row);
      inserted += 1;
    }

    console.log(`\nSeed complete. ${inserted} inserted, ${kept} left untouched.`);
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
