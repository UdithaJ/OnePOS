# Report Engine — Architecture

Status: **implemented**. All 7 reports run on the engine; the hand-written components, composables and `report.service.js` are deleted.
Scope: replaced the 7 hand-written report implementations with a definition-driven backend engine + a single generic frontend viewer.

Behaviour changes and preserved quirks: [`main/reports/MIGRATION-NOTES.md`](main/reports/MIGRATION-NOTES.md).
Verify with `npm run test:reports`.

---

## 1. Why — the motivating defect

The strongest argument for this change was not "less code", it is that the old split **computed the same numbers twice, differently** (line numbers refer to the deleted files, recoverable from git history):

| Concern | Table path | Export path |
|---|---|---|
| Date grouping | `useDailySalesReport.ts:36` — nested `Map` of dateKey → orderId | `useDailySalesExport.ts:29` — `seenOrdersForDate` / `seenDates` `Set`s |
| Per-date total | `useDailySalesReport.ts:57` | `useDailySalesExport.ts:31` |
| Grand total | `useDailySalesReport.ts:107` (filters `rowspanOrder > 0`) | `useDailySalesExport.ts:73` (tracks `seenOrders`) |

Two independent implementations of the same aggregation, in two files, with no test tying them together. They agree today by luck; any change to grouping rules must be made in both places or the Excel file silently disagrees with the screen. The same duplication exists for `PendingOrders` and `BankReconciliation`.

**The architectural fix:** compute grouping, spans and totals **once, on the server**, and have both the table and the exporter consume the identical payload.

Secondary benefit: a new report becomes one definition file plus a processor, with zero frontend work. (Total line count barely moves — see §9 for the honest accounting.)

---

## 2. What the engine had to cover *(pre-migration survey)*

The shape of the old code, kept here because it is the requirement set the engine was designed against.

**Backend** — `report.route.js` (7 routes) → `report.controller.js` (7 near-identical handlers) → `report.service.js` (7 aggregation functions, 400 lines). Returned raw flat rows.

**Frontend** — per report: `XReport.vue` (256–355 lines, ~85% duplicated header/filter/table/style), `useXReport.ts` (fetch + transform), `useXExport.ts` (Excel/PDF/CSV).

**What actually varied between the 7 reports:**

| Report | Params | Grouping / spans | Footer total | Special cells |
|---|---|---|---|---|
| Daily Sales | date range | order + date (date span on trailing column) | sum netAmount, once per order | status badge |
| Pending Orders | date range, status select | date + order | sum weight, all rows | status badge |
| Bank Reconciliation | date range | date | sum amount | — |
| Expenses | date range, category select (remote options) | none | sum amount | — |
| Returning Customers | **minOrderCount only — no dates** | none | sum totalWeight | — |
| Cash Box Summary | date range | none | sum paymentReceived | payment-method badge |
| Bank Transfer | date range | none | sum bankTransferAmount | — |

Notable: **no report has sections or sub-tables** — every one is a single flat table with optional row spans and one footer row.

Two details that constrain the schema more than they first appear:

- **Number formatting genuinely differs.** Daily Sales uses `.toFixed(2)` → `1500.00`; Cash Box and Bank Transfer use `.toLocaleString()` → `1,500` (thousands separator, no forced decimals); Pending Orders renders weight bare. A single `decimals` field cannot express all three.
- **Span topologies differ.** Daily Sales spans columns 1–6 by *order* and the **last** column by *date*. Pending Orders spans the **first** column by *date* and columns 2–6 by *order* — a properly nested case where date groups contain order groups. The grouper must handle both, and neither one subsumes the other.
- **Footers vary in width and units** — `colspan` 6/7/9/11 across reports, and Pending Orders appends a ` kg` suffix to its total.

---

## 3. Target architecture

```
                    ┌─────────────────── BACKEND ───────────────────┐
definitions/*.json ─┤ loader → param binder → processor pipeline ───┤
                    │              ↓              ↓                  │
 processors/*.js ───┤   (optional buildPipeline / postProcess)       │
                    │              ↓                                 │
                    │   grouper (spans) → totals → envelope builder  │
                    └───────────────────┬───────────────────────────┘
                                        │  ReportEnvelope (JSON)
                    ┌───────────────────┴─────── FRONTEND ──────────┐
                    │  useReport.ts                                  │
                    │      ├── ReportFilterBar.vue  (from params)    │
                    │      ├── ReportTable.vue      (from columns +  │
                    │      │                         rows + spans)   │
                    │      └── useReportExport.ts   (same envelope)  │
                    └────────────────────────────────────────────────┘
```

Two endpoints replace seven:

- `GET /api/reports` → catalog (id, titles, group, icon, permission, **and each report's `params`**) — drives both the nav menu and the filter bar, so opening a report needs no extra round trip.
- `GET /api/reports/:id?<params>&tz=<zone>` → `ReportEnvelope`.

One route replaces seven: `/reports/:reportId` → `ReportView.vue`.

---

## 4. Definition format — JSON *(decided)*

**Definitions are JSON**, parsed natively — no parser dependency. `schema/report.schema.json` is the authored contract and documents every field.

Two honest caveats about the schema, versus what §4 originally promised:

- Runtime validation is a hand-rolled checker (`engine/validateDefinition.js`), not the JSON Schema itself, because the project has no `ajv` and the engine was not worth a new dependency. The schema and the checker must be kept in step by hand; the checker covers the failures that would otherwise surface confusingly deep in the engine.
- `client/src/types/report.ts` **mirrors** the schema; it is not generated from it. Wiring a codegen step is a reasonable follow-up, but there is no build hook today.

The engine consumes a **parsed definition object**, so the loader is an isolated module — if definitions ever need to be authored in XML or YAML, only `definitionLoader.js` changes.

The full Daily Sales definition:

```jsonc
{
  "id": "daily-sales",
  "title": "Daily Sales Report",
  "permission": "admin",
  "group": "Sales",
  "params": [
    { "name": "fromDate", "type": "date", "label": "From Date", "default": "today", "required": true, "bind": "dayStart" },
    { "name": "toDate",   "type": "date", "label": "To Date",   "default": "today", "required": true, "bind": "dayEnd" }
  ],
  "source": { "model": "order", "processor": "daily-sales" },
  // Groups are declared OUTER to INNER: date contains orders, orders contain
  // category lines. An outer group may reference an inner one via distinctBy.
  "groups": [
    { "name": "date",  "by": "createdDate", "granularity": "day",
      "aggregates": [ { "key": "dateTotalAmount", "fn": "sum", "of": "netAmount", "distinctBy": "order" } ] },
    { "name": "order", "by": "orderId" }
  ],
  "columns": [
    { "key": "createdDate",     "label": "Date",             "type": "date",   "span": "order" },
    { "key": "orderNo",         "label": "Order No",         "type": "text",   "span": "order", "pad": 4 },
    { "key": "customerName",    "label": "Customer",         "type": "text",   "span": "order" },
    { "key": "deliveryDate",    "label": "Delivery Date",    "type": "date",   "span": "order" },
    { "key": "status",          "label": "Status",           "type": "badge",  "span": "order", "valueMap": "orderStatus" },
    { "key": "rackNumber",      "label": "Rack No",          "type": "text",   "span": "order", "align": "center", "emptyAs": "-" },
    { "key": "categoryName",    "label": "Laundry Category", "type": "text" },
    { "key": "weight",          "label": "Weight (kg)",      "type": "number", "align": "right", "format": "plain" },
    { "key": "amount",          "label": "Amount",           "type": "number", "align": "right", "format": "fixed", "decimals": 2 },
    { "key": "discount",        "label": "Discount",         "type": "number", "align": "right", "format": "fixed", "decimals": 2, "span": "order", "zeroAs": "-" },
    { "key": "netAmount",       "label": "Net Amount",       "type": "number", "align": "right", "format": "fixed", "decimals": 2, "span": "order" },
    { "key": "dateTotalAmount", "label": "Total Amount",     "type": "number", "align": "right", "format": "fixed", "decimals": 2, "span": "date", "emphasis": true }
  ],
  "footer": { "label": "Total for the given period", "column": "dateTotalAmount",
              "fn": "sum", "of": "netAmount", "distinctBy": "order" }
}
```

`distinctBy` is the key expressive element: it is what encodes "sum net amount once per order, not once per sub-order row" — the rule currently reimplemented twice in hand-written code. **All 7 existing reports are expressible in this model**, including the two-level Daily Sales / Pending Orders grouping.

Other declarative elements:

- **Param types** — `date`, `number`, `text`, `select` (static `options`) and `select` with `optionsFrom` (e.g. `/api/expense-categories`, for the Expenses report). Returning Customers simply declares one `number` param; **there is no baked-in date range** anywhere in the model.
- **`bind`** — `dayStart` / `dayEnd` mark which params become local-day boundaries (see §8).
- **`valueMap`** — named lookup (`orderStatus`, `paymentMethod`) in a shared `valueMaps` file, giving label + colour variant, replacing the per-component `STATUS_DISPLAY` / `statusClass` / `methodClass` helpers.
- **`format`** — must cover all three existing styles, or the parity gate in §11 is unreachable:

  | `format` | Renders `1500` as | Replaces | Used by |
  |---|---|---|---|
  | `fixed` + `decimals` | `1500.00` | `.toFixed(2)` | Daily Sales, Expenses, Bank Reconciliation |
  | `grouped` | `1,500` | `.toLocaleString()` | Cash Box Summary, Bank Transfer |
  | `plain` | `1500` | bare interpolation | Pending Orders (weight) |

  Plus two modifiers available on both columns and footers: **`suffix`** (Pending Orders' total is `142 kg`) and **`zeroAs`** (several columns render `-` instead of `0` — currently `row.discount > 0 ? … : '-'`).

---

## 5. The contract: `ReportEnvelope`

This is the load-bearing piece — everything else is replaceable around it.

```jsonc
{
  "report": {
    "id": "daily-sales",
    "title": "Daily Sales Report",
    "generatedAt": "2026-07-30T09:15:00.000Z",
    "params": { "fromDate": "2026-07-01", "toDate": "2026-07-30" },
    "paramSummary": "Period: 01/07/2026 to 30/07/2026"
  },
  "columns": [
    { "key": "createdDate", "label": "Date", "type": "date", "align": "left" },
    { "key": "status", "label": "Status", "type": "badge",
      "valueMap": { "todo": { "label": "To Do", "variant": "neutral" },
                    "done": { "label": "Done", "variant": "success" } } },
    { "key": "amount", "label": "Amount", "type": "number", "align": "right", "decimals": 2 }
  ],
  "rows": [
    {
      "values": { "createdDate": "2026-07-01T…", "orderNo": 12, "status": "done",
                  "amount": 1500, "netAmount": 4200, "dateTotalAmount": 9800 },
      "spans":  { "createdDate": 3, "orderNo": 3, "status": 3,
                  "categoryName": 1, "amount": 1, "netAmount": 3, "dateTotalAmount": 7 }
    }
  ],
  "footer": [
    { "label": "Total for the given period", "column": "dateTotalAmount",
      "value": 48250, "labelSpan": 11 }
  ],
  "meta": { "rowCount": 142, "truncated": false }
}
```

Design rules:

1. **`spans` is keyed by column, not positionally nested.** `0` = cell suppressed (covered from above), `1` = normal, `N` = `rowspan="N"`. This is required because the two grouped reports have *opposite* topologies: Daily Sales spans columns 1–6 by order with the date span on the **last** column, while Pending Orders spans the **first** column by date with order spans on 2–6. A positional or strictly-nested tree model expresses one and not the other; a per-column map expresses both.
2. **Values stay raw and typed; formatting is declared, not applied.** The server sends `1500` and `format: "fixed", decimals: 2`, not `"1500.00"`. The table formats for display; the Excel exporter writes a real number (today's exporter writes `.toFixed(2)` strings, so Excel cells are text and can't be summed — this fixes that as a side effect, and is a deliberate, visible difference from today's output; see the parity gate in §11).
3. **`labelSpan` is derived, never authored.** It is the index of `footer.column` in `columns[]` — reproducing the hand-written `colspan="11"` / `"9"` / `"7"` / `"6"` without anyone maintaining those numbers. Definitions declare only which column the value lands in.
4. **The exporter consumes this exact envelope.** No second aggregation path exists, by construction.
5. **No `sections` in v1** — verified unnecessary across all 7 reports. If a future report needs sub-tables, `sections: [{ title, columns, rows, footer }]` is an additive extension; `rows`/`columns` at top level become the single implicit section.

---

## 6. Processors — the escape hatch

The declarative layer must not grow into a re-implementation of the Mongo aggregation language. Anything it can't express goes in a JS processor, auto-loaded by id from `main/reports/processors/<id>.js`. All hooks optional:

```js
module.exports = {
  // Full control of the aggregation pipeline; params are already validated & coerced.
  buildPipeline(params, ctx) { return [ /* $match / $lookup / $unwind / $project */ ]; },

  // Derived fields the aggregation can't express (e.g. netAmount = totalAmount - discount).
  postProcess(rows, params, ctx) { return rows; },
};
```

**Hard rule: processors return flat rows only.** Grouping, spans, aggregates and totals are always the engine's job, driven by the definition. This is the discipline that makes the divergence bug in §1 structurally impossible — there is exactly one place those numbers are computed.

In practice the existing 7 aggregations move into 7 processors largely unchanged, which keeps the migration low-risk: the queries are already written and working.

---

## 7. Engine pipeline

`runReport(id, rawParams, ctx)`:

1. **Load** definition (parsed once, cached; watch-and-reload in dev).
2. **Bind params** — whitelist against the definition, coerce types, apply defaults, reject unknown/missing. Client input can only fill declared params; it can never influence query structure.
3. **Query** — `processor.buildPipeline(params)`, or the declarative `source` for simple cases.
4. **Post-process** — `processor.postProcess(rows, params)`.
5. **Group** — compute group keys, per-group aggregates, and per-column `spans`.
6. **Total** — evaluate footer entries (`fn`/`of`/`distinctBy`).
7. **Envelope** — attach resolved columns (with `valueMap`s inlined) and metadata.

Steps 1, 2, 5, 6, 7 are shared by every report. Only 3 and 4 are per-report.

Security: definitions and processors are trusted server-side files, never client-supplied; client params are whitelisted by the definition; `permission` on the definition is enforced in the controller and mirrored to the frontend route guard via the catalog.

---

## 8. Timezone boundary

Today the client converts to local day boundaries (`localDayStartISO` / `localDayEndISO`) and the backend receives absolute instants — `report.service.js` comments depend on this. Local-day *bucketing* also happens client-side (`toLocalDateKey`). Moving grouping to the server means the server now needs the timezone.

**Decision: keep the existing convention and add an explicit timezone.** The client continues sending absolute instants for `dayStart`/`dayEnd`-bound params (preserving current service semantics exactly), and additionally sends `tz` (`Intl.DateTimeFormat().resolvedOptions().timeZone`) on every report request. The engine uses it for `$dateToString`/`$dateTrunc` when a group declares `granularity="day"`. Day bucketing then matches what the user sees, exactly as `toLocalDateKey` does today.

---

## 9. Frontend

Single route `/reports/:reportId` → `ReportView.vue`, which is generic:

```
client/src/
  components/reports/
    ReportView.vue        # header, filter bar, states, table, export buttons
    ReportFilterBar.vue   # renders inputs from params[]
    ReportTable.vue       # renders columns[] + rows[] + spans + footer[]
  composables/
    useReport.ts          # catalog (shared with the nav) + run + state
    useReportExport.ts    # Excel / PDF / CSV from the envelope
  utils/
    reportFormat.ts       # cell/footer formatting, display and export modes
    reportRows.ts         # flat export matrix — pure, so the parity test drives it
  types/report.ts         # envelope types (mirrors report.schema.json)
```

Cell rendering is handled inside `ReportTable.vue` rather than a separate `ReportCell.vue` — the four column types are a few lines each, and a per-cell component added indirection without saving anything.

The SCSS from the old `DailySalesReport.vue` moved into `ReportTable.vue` and `ReportView.vue` essentially as-is, so the result is visually unchanged; every report already shared these styles.

**Deleted:** 7 `*Report.vue` + 6 `use*Report.ts` + 7 `use*Export.ts` + `report.service.js` — 21 files, 3,694 lines.

**Added:** ~2,480 lines of production code, plus 717 lines of tests where there were none. The headline saving is smaller than a raw diff suggests, and worth being honest about: roughly 1,500 of the new lines are the *reusable* engine and viewer, while ~980 are the per-report definitions and processors — and the processors are mostly the old aggregation pipelines moved verbatim. The real win is marginal, not total: the 8th report costs a definition file and a pipeline (~100 lines, no frontend work) instead of a component, a composable and an exporter (~500 lines, three files to keep in sync).

Export note: keeping Excel/PDF/CSV client-side (current `xlsx` / `jsPDF` setup) is the lower-risk path and needs no new infrastructure — the win is that there is now *one* exporter instead of seven. Server-side export is a later option if large reports become a memory problem in the Electron renderer.

---

## 10. Directory layout (backend)

```
main/
  reports/
    engine/
      index.js            # runReport(), listReports()
      definitionLoader.js # parse + validate + cache
      paramBinder.js
      grouper.js          # group keys, aggregates, spans, footer aggregation
      envelope.js         # assembles columns + rows + footer
      valueMaps.js        # orderStatus, paymentMethod
      validateDefinition.js
    definitions/
      daily-sales.json          bank-reconciliation.json
      pending-orders.json       expenses.json
      returning-customers.json  cash-box-summary.json
      bank-transfer-tracking.json
    processors/                 # one per report; queries only
      daily-sales.js  pending-orders.js  bank-reconciliation.js
      expenses.js     returning-customers.js
      cash-box-summary.js  bank-transfer.js
    schema/report.schema.json
    __tests__/                  # npm run test:reports
      definitions.test.js  grouping-parity.test.js  csv-parity.test.js
    MIGRATION-NOTES.md
  controllers/report.controller.js   # 2 handlers: list, run
  routes/report.route.js             # GET /api/reports, GET /api/reports/:id
```

Footer aggregation shares `evaluateAggregate()` in `grouper.js` rather than living in a separate `totals.js` — a grand total is the same operation as a group aggregate applied to every row, and splitting them would have meant two implementations of `distinctBy`, which is the exact mistake this redesign exists to remove.

`report.service.js` is deleted; its aggregations live in the processors.

---

## 11. Parity — how it was verified

Per decision 3 the legacy per-report endpoints were removed rather than kept alongside, so there is no runtime old-vs-new diff. Instead of capturing golden CSV files by hand, the old algorithms were **re-implemented verbatim inside the test suite** from the deleted composables. That is a stronger net than fixtures: it re-derives the expected output on every run instead of trusting a file someone exported once, and it needs no seeded database.

`npm run test:reports` — 56 checks, all passing:

| Suite | Proves |
|---|---|
| `definitions.test.js` | All 7 definitions load and validate; each resolves its processor and model and builds a pipeline; params are whitelisted; bad input yields 400/404 rather than 500 |
| `grouping-parity.test.js` | Engine ordering, spans, per-group totals and grand totals match the **old composables' algorithms**, re-implemented verbatim |
| `csv-parity.test.js` | Compiles the shipped `reportFormat.ts` / `reportRows.ts` with the project's own tsc and drives them — so it tests the real export code, not a copy |

**The acceptance criterion held for Daily Sales:** its CSV is byte-identical to the old `useDailySalesExport` output.

**Pending Orders is deliberately not byte-identical**, and could not be — its old table and old CSV disagreed with each other (deviation 1 below). It is covered instead by assertions on the specific cells that changed, plus full span/total parity against the old composable in `grouping-parity.test.js`. It still had to be migrated alongside Daily Sales: it has the *opposite* span topology (§5, rule 1), so neither report alone proves the grouper.

Both were also run against the live database, along with the other five — all seven return data through the engine end to end.

Three deviations from the old output are deliberate and asserted in the tests; all are documented in [`main/reports/MIGRATION-NOTES.md`](main/reports/MIGRATION-NOTES.md):

1. **Pending Orders CSV** — Due Date is now suppressed per *date* group, matching the table. The old CSV suppressed per *order*, so it disagreed with its own table. The two are contradictory; the table wins.
2. **Excel numeric cells** — now real numbers where they were `.toFixed(2)` strings, so amounts can be summed in the spreadsheet (§5, rule 2). CSV and PDF are unaffected.
3. **Four reports' display/export formatting split** (`1,500` on screen vs `1500.00` in CSV) is *preserved exactly* via `exportFormat` overrides rather than silently unified, since exports may be consumed downstream. MIGRATION-NOTES lists how to unify it later.

Not covered by automated tests, and worth a look on real data before release: PDF layout (visual review only), and the Vuetify filter inputs, which are rendered generically now.

---

## 12. Decisions — all locked

1. **JSON definitions** — one schema validates definitions and generates the frontend envelope types.
2. **Exports stay client-side** in v1, using the existing `xlsx` / `jsPDF` setup — one generic exporter replaces seven.
3. **No per-report endpoints.** The 7 legacy routes are removed rather than kept alongside; `GET /api/reports/:id` is the only report data endpoint. Consequence for the parity gate: see §11.
4. **Nav generated from the catalog** — the Reports menu in `MainLayout.vue` is built from `GET /api/reports`, grouped by the definition's `group` field. Adding a definition file adds a menu entry with no frontend change.
