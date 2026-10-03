// Removes secrets from anything an upgrade shows back or records.
//
// Two places need this and both are easy to overlook:
//
//   - the preview returns sample documents from whatever collection the script
//     names, which would otherwise make it a way to read password hashes out of
//     the users collection,
//   - the applied script is stored on the log row for audit, which would record
//     any password or key the script itself sets, in plain text, forever.
//
// Matching is by field name rather than by value, because a hash and a
// plaintext password look the same from here.

const SENSITIVE_KEY = /pass(word|wd)|secret|token|api[-_]?key|credential|private[-_]?key|otp/i;

const REDACTED = '[redacted]';

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') return value;

  // Leave anything that isn't a plain object alone — an ObjectId or a Date has
  // no sensitive keys and would be mangled by rebuilding it.
  if (value.constructor && value.constructor.name !== 'Object') return value;

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(child);
  }
  return out;
}

module.exports = { redact, SENSITIVE_KEY, REDACTED };
