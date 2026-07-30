# Report engine migration — behaviour notes

What changed when the seven hand-written reports were replaced by the
definition-driven engine. Architecture and rationale live in
`REPORT_ENGINE_ARCHITECTURE.md` at the repo root.

## The defect this fixes

Grouping and totals used to be implemented **twice per report** — once in
`use*Report.ts` for the table, once again in `use*Export.ts` for Excel/PDF/CSV —
with nothing tying the two together. Both consumers now read spans and
aggregates computed once by `engine/grouper.js`, so they cannot drift.

While migrating, two places where the old pair had already drifted came to
light. They are listed under "Deliberate deviations" below.

## Verified parity

`npm run test:reports` runs three suites:

| Suite | What it proves |
|---|---|
| `definitions.test.js` | All 7 definitions load, validate, resolve their processor and model, and build a pipeline |
| `grouping-parity.test.js` | Engine spans, ordering and totals match the **old composables' algorithms**, re-implemented verbatim in the test |
| `csv-parity.test.js` | Compiles the real `reportFormat.ts` / `reportRows.ts` and asserts Daily Sales CSV is **byte-identical** to the old `useDailySalesExport` output |

The Daily Sales CSV check is the acceptance gate from §11 of the architecture
doc. It passes.

## Deliberate deviations

### 1. Pending Orders — Due Date merging in CSV *(bug fix)*

The old table merged Due Date across a whole **date** group (`rowspanDate`), but
`usePendingOrdersExport.buildFlatRows` suppressed it per **order**
(`isFirstOrder`). So a date containing three orders printed the date once on
screen and three times in the CSV.

These are contradictory; the engine cannot produce both. The table's behaviour
wins, so the CSV now repeats the date once per date group. Asserted in
`csv-parity.test.js`.

### 2. Excel numeric cells are now numbers, not text *(improvement)*

The old exporters wrote `.toFixed(2)` **strings** into numeric columns, so Excel
treated amounts as text — they could not be summed or filtered numerically. The
envelope carries raw values plus a format description, so `excelCell()` writes
real numbers. CSV and PDF are unaffected and remain byte-identical.

### 3. Bank Transfer Tracking report id

Route is unchanged (`/reports/bank-transfer-tracking`) — the definition id was
set to match the old URL so existing bookmarks keep working. Its processor file
is `processors/bank-transfer.js`.

## Preserved inconsistencies (tech debt, deliberate)

Four reports rendered the **same value differently** on screen and in exports:
the table used `.toLocaleString()` (`1,500`) while the exporter used
`.toFixed(2)` (`1500.00`).

| Report | Columns affected |
|---|---|
| Bank Reconciliation | Amount, footer |
| Expenses | Amount, footer |
| Cash Box Summary | all amount columns, footer |
| Bank Transfer Tracking | all amount columns, footer |

This is almost certainly accidental, but changing it would alter output people
may depend on, so it is preserved exactly via the `exportFormat` /
`exportDecimals` / `exportSuffix` column and footer overrides.

Pending Orders has the same split on its footer: the table shows `24 kg`, the
CSV shows `24` (`suffix` vs `exportSuffix`).

**To unify later:** delete the `export*` keys from the affected definitions and
update the assertions in `csv-parity.test.js`. No engine change is needed.

## Behaviour worth knowing about

- **`GET /api/reports` is fetched for every logged-in user**, not just admins,
  because `MainLayout` builds the Reports submenu from it. The menu is still
  hidden from non-admins by the existing `adminOnly` filter, so nothing is shown
  that was not shown before — but it is a request that did not previously
  happen. Like the old per-report routes, this endpoint has no backend auth
  middleware; adding one would be an improvement, not a regression fix.
- **An unknown `/reports/:reportId`** used to 404 at the router. The route now
  always matches, so `ReportView` shows a "No report named X exists" warning
  instead.

## Adding a report

1. Add `definitions/<id>.json` (see `schema/report.schema.json`).
2. Add `processors/<id>.js` exporting `buildPipeline({ params, timezone })`, and
   `postProcess(rows, ctx)` if derived fields are needed.
3. Nothing else — the route, the nav entry, the filter bar, the table and all
   three export formats are generated from the definition.

**Rule:** processors return flat rows only. Grouping, spans, aggregates and
totals belong to the engine — that is what keeps the table and the exports from
diverging again.
