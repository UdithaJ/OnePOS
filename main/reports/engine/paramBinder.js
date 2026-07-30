// Binds raw query input to the parameters a definition declares.
//
// This is the only place client input enters the engine. Anything the
// definition does not declare is dropped, so a request can fill declared
// values but can never influence query structure.

function bindParams(definition, query) {
  const declared = definition.params || [];
  const values = {};
  const raw = {};

  for (const param of declared) {
    let value = query[param.name];

    if (value === undefined || value === '') {
      if (param.required) {
        const err = new Error(`Missing required parameter "${param.name}"`);
        err.status = 400;
        throw err;
      }
      value = param.serverDefault ?? null;
    }

    raw[param.name] = value;
    values[param.name] = value === null ? null : coerce(param, value);
  }

  return { values, raw, timezone: resolveTimezone(query.tz) };
}

function coerce(param, value) {
  switch (param.type) {
    case 'date': {
      // The client sends an absolute ISO instant already positioned at the
      // local start/end of the chosen day (see the `bind` field and §8 of
      // REPORT_ENGINE_ARCHITECTURE.md), so this is a straight parse.
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        const err = new Error(`Parameter "${param.name}" is not a valid date`);
        err.status = 400;
        throw err;
      }
      return date;
    }
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) {
        const err = new Error(`Parameter "${param.name}" is not a number`);
        err.status = 400;
        throw err;
      }
      return num;
    }
    case 'select':
    case 'text':
    default:
      return String(value);
  }
}

// Day-grouping happens server-side now, so the engine needs the shop's
// timezone. The client sends its own IANA zone; fall back to the server's.
function resolveTimezone(tz) {
  if (typeof tz === 'string' && tz) {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: tz });
      return tz;
    } catch {
      // fall through to the server default
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

module.exports = { bindParams };
