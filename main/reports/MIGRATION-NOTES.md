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

### 4. Daily Sales — Payment Status filter and column *(feature, post-migration)*

Daily Sales gained a **Payment Status** filter (All / Paid / Not Paid /
Partially Paid) beside the date range, and a matching order-level column after
Status. Orders with no `paymentStatus` field (created before it existed) are
treated as Not Paid, both in the filter and in the column — the same way
`OrderList.vue` shows them.

This adds one column to the CSV/Excel/PDF layout, so every column from Rack No
onwards shifts one place right and the footer label spans 12 columns, not 11.
The CSV parity gate still holds everywhere else: the legacy exporter in
`csv-parity.test.js` differs from the original only by that one column.

### 5. Pending Orders — Order Created Date column *(feature, post-migration)*

Pending Orders gained an order-level **Order Created Date** column after
Order No. Like the Daily Sales addition above, it shifts the later columns one
place right in CSV/Excel/PDF, and the footer label now spans 8 columns, not 7.

### 6. Cash Box Summary — Payment Date replaces Business Date *(feature, post-migration)*

The report period now filters on each **payment's date**, not the order's
creation date, and the Business Date column (the opening time of the cash box
session that recorded the payment) is replaced by **Payment Date** in the same
position. A settlement taken today for last week's order is now counted today;
previously it was counted on the day the order was created. The processor
starts from `payments` instead of `orders`, and no longer joins the cash ledger
or sessions. Column positions are unchanged, so the exports keep their layout.

### 7. Business-day option on the cash reports *(feature, post-migration)*

Cash Box Summary, Expenses and Bank Reconciliation have a **Date Basis** filter:

- **Transaction Date** (default) — each payment/expense by its own date, as before.
- **Business Day** — each by the opening day of the cash box session it was
  recorded in (via its cash-ledger row), so after-midnight activity in a
  session that opened the evening before reconciles to that earlier day across
  all three reports. Rows recorded without a session fall back to their own date.

In Business Day mode, Expenses and Bank Reconciliation show and group by the
business date; Cash Box Summary still shows each payment's own Payment Date.
The shared join lives in `processors/shared/businessDay.js`. Bank Transfer
Tracking got its own Date Basis filter later (see 8).

### 8. Bank Transfer Tracking — Date Basis filter *(feature, post-migration)*

Bank Transfer Tracking has a **Date Basis** filter:

- **Order Created Date** (default) — bank payments on orders created in the
  period, as before.
- **Payment Date** — each bank payment by its own date.
- **Business Day** — each by the opening day of the cash box session it was
  recorded in, using the same join as the cash reports (see 7).

The processor now starts from `payments` instead of `orders`. Columns are
unchanged; with Payment Date or Business Day the rows are sorted by Bank
Transfer Date instead of Order Created Date.

## Number formats (unified)

Reports used to format the same value differently: the table used
`.toLocaleString()` (`1,500`, decimals dropped) while the exporter used
`.toFixed(2)` (`1500.00`) in Bank Reconciliation, Expenses, Cash Box Summary and
Bank Transfer Tracking; Daily Sales used `1500.00` on screen; weights printed
bare (`2.3`). These were preserved through the migration via `exportFormat` /
`exportDecimals` overrides and have since been unified to match the printed
bill:

| Value | Screen, PDF | Excel | CSV |
|---|---|---|---|
| Amounts (`grouped`, 2 decimals) | `1,950.00` | number, format `#,##0.00` | `1950.00` |
| Weights (`fixed`, 2 decimals) | `2.30` | number, format `0.00` | `2.30` |

CSV leaves out the thousands separator by design, so the file imports into
other tools as numbers rather than quoted text. No definition uses
`exportFormat` / `exportDecimals` any more; the overrides remain available.

Pending Orders still has one deliberate split on its footer: the table shows
`24.00 kg`, the exports `24.00` (`suffix` vs `exportSuffix`), because the column
header already says (kg).

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
