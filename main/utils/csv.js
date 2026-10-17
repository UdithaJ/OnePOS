// A small CSV reader for files people export from Excel or Google Sheets.
//
// Handles quoted fields (with commas, doubled quotes and line breaks inside),
// CRLF and LF line endings and the byte order mark Excel puts at the start of a
// UTF-8 file. Returns every record as an array of strings, untrimmed.

function parseCsv(text) {
  const input = String(text ?? '').replace(/^﻿/, '');
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
    } else {
      field += ch;
    }
    i += 1;
  }

  if (inQuotes) {
    const err = new Error('The file ends inside a quoted value — a closing " is missing.');
    err.status = 422;
    throw err;
  }

  // The last line has no line break after it.
  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }

  return records;
}

module.exports = { parseCsv };
