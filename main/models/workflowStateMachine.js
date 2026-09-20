const mongoose = require('mongoose');

// One row per permitted state change, for any entity that has a workflow.
// `entity` scopes a machine: today only 'order', but the shape is deliberately
// general so a second entity needs rows, not a new collection.
//
// A (entity, from, to) triple that has no enabled row is not a permitted move,
// so removing or disabling a row withdraws the transition.
//
// Seeded by: node main/scripts/seedWorkflowStateMachine.js
const workflowStateMachineSchema = new mongoose.Schema({
  entity: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  from: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  to: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  // Who may make this move. Omitted means anyone; a non-empty list restricts it.
  // An empty list is rejected rather than silently meaning "anyone", so clearing
  // the field in a future editor cannot quietly open a restricted transition.
  roles: {
    type: [String],
    default: undefined,
    validate: {
      validator: (v) => v === undefined || v === null || v.length > 0,
      message: 'roles must be omitted (anyone) or contain at least one role',
    },
  },
  // Names of conditions the entity must satisfy first, resolved against
  // main/workflow/guards.js.
  guards: {
    type: [String],
    default: [],
  },
  // Lets a rule be withdrawn without deleting the row.
  enabled: {
    type: Boolean,
    default: true,
  },
}, {
  // Pinned so the collection reads as intended rather than mongoose's
  // pluralised lowercase default (workflowstatemachines).
  collection: 'workflowStateMachine',
});

workflowStateMachineSchema.index({ entity: 1, from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model('WorkflowStateMachine', workflowStateMachineSchema);
