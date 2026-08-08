// Shared lookup tables for `badge` columns.
//
// A definition references one of these by name (`"valueMap": "orderStatus"`);
// the engine inlines the resolved map into the envelope so the client needs no
// per-report knowledge. Replaces the STATUS_DISPLAY / statusClass / methodClass
// helpers that were copy-pasted into each report component.
//
// `variant` is a semantic name; the client maps it to a chip colour.

const VALUE_MAPS = {
  orderStatus: {
    todo: { label: 'To Do', variant: 'todo' },
    done: { label: 'Done', variant: 'done' },
    delivered: { label: 'Delivered', variant: 'delivered' },
    cancelled: { label: 'Cancelled', variant: 'cancelled' },
  },
  paymentMethod: {
    cash: { label: 'Cash', variant: 'cash' },
    bank: { label: 'Bank Transfer', variant: 'bank' },
  },
};

function resolveValueMap(name) {
  const map = VALUE_MAPS[name];
  if (!map) throw new Error(`Unknown valueMap "${name}"`);
  return map;
}

module.exports = { VALUE_MAPS, resolveValueMap };
