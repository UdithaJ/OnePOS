// Validates an upgrade script before anything touches the database.
//
// A script is data, not code: a list of operations naming a collection, a
// filter and what to write. That distinction is the whole safety story, and it
// only holds if the operators that make MongoDB execute JavaScript are refused
// — $where, $function and $accumulator all run JS inside mongod, and $out and
// $merge can replace an entire collection. They are rejected wherever they
// appear, at any depth.
//
// Everything here is pure, so it can be tested without a database.

const ALLOWED_OPS = [
  'insertOne', 'insertMany',
  'updateOne', 'updateMany',
  'deleteOne', 'deleteMany',
];

const INSERT_OPS = ['insertOne', 'insertMany'];
const UPDATE_OPS = ['updateOne', 'updateMany'];
const DELETE_OPS = ['deleteOne', 'deleteMany'];

// Operators that execute code or rewrite collections wholesale.
const FORBIDDEN_OPERATORS = ['$where', '$function', '$accumulator', '$out', '$merge', '$eval'];

function fail(message) {
  const err = new Error(message);
  err.status = 422;
  return err;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Walks the whole structure looking for a forbidden operator used as a key.
function findForbiddenOperator(value, path = '') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findForbiddenOperator(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OPERATORS.includes(key)) {
      return { operator: key, path: path ? `${path}.${key}` : key };
    }
    const hit = findForbiddenOperator(child, path ? `${path}.${key}` : key);
    if (hit) return hit;
  }
  return null;
}

function assertNoForbiddenOperators(value, where) {
  const hit = findForbiddenOperator(value);
  if (hit) {
    throw fail(
      `${where} uses "${hit.operator}", which is not allowed in an upgrade script ` +
      `(found at ${hit.path}). It can execute code or replace a whole collection.`
    );
  }
}

// Mongo's own reserved collections, plus anything that isn't a plain name.
function assertValidCollection(name, where) {
  if (typeof name !== 'string' || !name.trim()) {
    throw fail(`${where} must name a collection.`);
  }
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(name)) {
    throw fail(`${where} names an invalid collection "${name}".`);
  }
  if (name.startsWith('system.')) {
    throw fail(`${where} may not target the internal collection "${name}".`);
  }
}

// An update must use operators ($set, $unset, …). A bare document replaces the
// whole record, which is almost never what an upgrade means and silently drops
// every field it does not mention.
function assertUpdateUsesOperators(update, where) {
  if (!isPlainObject(update) || Object.keys(update).length === 0) {
    throw fail(`${where} needs an "update".`);
  }
  const keys = Object.keys(update);
  const nonOperator = keys.filter(k => !k.startsWith('$'));
  if (nonOperator.length) {
    throw fail(
      `${where} must use update operators such as $set. Writing plain fields ` +
      `(${nonOperator.join(', ')}) replaces the entire document and discards everything else.`
    );
  }
}

// An empty filter means every document in the collection. That is sometimes
// what a backfill wants, but never by accident, so it has to be stated.
function assertFilter(operation, index) {
  const where = `Operation ${index + 1} (${operation.op})`;
  if (!isPlainObject(operation.filter)) {
    throw fail(`${where} needs a "filter".`);
  }
  if (Object.keys(operation.filter).length === 0 && operation.confirmAll !== true) {
    throw fail(
      `${where} has an empty filter, which matches every document in ` +
      `"${operation.collection}". Add "confirmAll": true to the operation if that is intended.`
    );
  }
}

function validateOperation(operation, index) {
  const where = `Operation ${index + 1}`;
  if (!isPlainObject(operation)) throw fail(`${where} must be an object.`);
  if (!ALLOWED_OPS.includes(operation.op)) {
    throw fail(`${where} has an unsupported op "${operation.op}". Allowed: ${ALLOWED_OPS.join(', ')}.`);
  }
  assertValidCollection(operation.collection, `${where} (${operation.op})`);
  assertNoForbiddenOperators(operation, `${where} (${operation.op})`);

  if (INSERT_OPS.includes(operation.op)) {
    const docs = operation.op === 'insertOne' ? [operation.document] : operation.documents;
    if (!Array.isArray(docs) && operation.op === 'insertMany') {
      throw fail(`${where} (insertMany) needs a "documents" array.`);
    }
    const list = operation.op === 'insertOne' ? [operation.document] : docs;
    if (!list.length || !list.every(isPlainObject)) {
      throw fail(`${where} (${operation.op}) needs ${operation.op === 'insertOne' ? 'a "document" object' : 'at least one document'}.`);
    }
  }

  if (UPDATE_OPS.includes(operation.op)) {
    assertFilter(operation, index);
    assertUpdateUsesOperators(operation.update, `${where} (${operation.op})`);
  }

  if (DELETE_OPS.includes(operation.op)) {
    assertFilter(operation, index);
  }
}

// Returns the script unchanged when it is usable, throws a 422 naming the
// problem otherwise. Never partially accepts: a script is valid or it is not.
function validateScript(script) {
  if (!isPlainObject(script)) throw fail('The upgrade script must be a JSON object.');
  if (typeof script.action !== 'string' || !script.action.trim()) {
    throw fail('The upgrade script needs an "action" naming what it does.');
  }
  if (script.version !== undefined && (!Number.isInteger(script.version) || script.version < 1)) {
    throw fail('"version" must be a whole number of 1 or more.');
  }
  if (!Array.isArray(script.operations) || script.operations.length === 0) {
    throw fail('The upgrade script needs a non-empty "operations" array.');
  }
  script.operations.forEach(validateOperation);
  return {
    action: script.action.trim(),
    version: script.version ?? 1,
    description: typeof script.description === 'string' ? script.description : '',
    operations: script.operations,
  };
}

module.exports = {
  ALLOWED_OPS,
  INSERT_OPS,
  UPDATE_OPS,
  DELETE_OPS,
  FORBIDDEN_OPERATORS,
  findForbiddenOperator,
  validateScript,
};
