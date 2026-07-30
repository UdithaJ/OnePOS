<template>
  <div class="table-card">
    <div class="table-wrapper">
      <table class="report-table">
        <thead>
          <tr>
            <th
              v-for="column in envelope.columns"
              :key="column.key"
              :class="{ 'num-th': column.align === 'right' }"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(row, idx) in envelope.rows"
            :key="idx"
            :class="idx % 2 === 0 ? 'row-even' : 'row-odd'"
          >
            <!-- A span of 0 means this cell is covered by a rowspan from an
                 earlier row, so it is not rendered at all. -->
            <template v-for="column in envelope.columns" :key="column.key">
              <td
                v-if="spanOf(row.spans, column.key) > 0"
                :rowspan="spanOf(row.spans, column.key)"
                :class="cellClass(column)"
              >
                <span
                  v-if="column.type === 'badge' && row.values[column.key]"
                  :class="['chip', `chip-${badgeVariant(column, row.values[column.key])}`]"
                >
                  {{ formatCell(row.values[column.key], column) }}
                </span>
                <template v-else>
                  {{ formatCell(row.values[column.key], column) }}
                </template>
              </td>
            </template>
          </tr>
        </tbody>

        <tfoot v-if="envelope.footer.length">
          <tr v-for="entry in envelope.footer" :key="entry.column" class="grand-total-row">
            <!-- labelSpan is derived server-side from the column index; it
                 replaces the colspan that used to be hand-maintained per
                 report. -->
            <td :colspan="entry.labelSpan" class="grand-total-label">{{ entry.label }}</td>
            <td class="grand-total-value">{{ formatFooter(entry) }}</td>
            <td v-for="key in trailingColumns(entry)" :key="key"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { ReportColumn, ReportEnvelope, ReportFooterEntry } from '@/types/report'
import { formatCell, formatFooter, spanOf } from '@/utils/reportFormat'

const props = defineProps<{ envelope: ReportEnvelope }>()

function cellClass(column: ReportColumn): string[] {
  const classes: string[] = []
  if (column.type === 'number' || column.align === 'right') classes.push('num-cell')
  if (column.align === 'center') classes.push('center-cell')
  if (column.type === 'date') classes.push('date-cell')
  if (column.emphasis) classes.push('total-cell')
  return classes
}

function badgeVariant(column: ReportColumn, value: unknown): string {
  return column.valueMap?.[String(value)]?.variant ?? 'neutral'
}

// Footer value columns are not always last (they are for all current reports,
// but the envelope does not require it), so pad any columns after the value.
function trailingColumns(entry: ReportFooterEntry): string[] {
  const valueIndex = props.envelope.columns.findIndex((column) => column.key === entry.column)
  if (valueIndex < 0) return []
  return props.envelope.columns.slice(valueIndex + 1).map((column) => column.key)
}
</script>

<style scoped lang="scss">
.table-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  thead tr {
    background: #0d3d38;
    color: #fff;
  }

  th {
    padding: 12px 14px;
    text-align: left;
    font-weight: 600;
    white-space: nowrap;
    font-size: 12px;
    letter-spacing: 0.03em;

    &.num-th { text-align: right; }
  }

  td {
    padding: 10px 14px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
    color: #1f2937;
  }

  .row-even td { background: #fff; }
  .row-odd td  { background: #f9fafb; }

  .date-cell   { white-space: nowrap; }
  .center-cell { text-align: center; }
  .num-cell    { text-align: right; font-variant-numeric: tabular-nums; }

  .total-cell {
    text-align: right;
    font-weight: 700;
    font-size: 14px;
    color: #0d3d38;
    background: #ecfdf5 !important;
    vertical-align: middle;
  }
}

.chip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;

  &.chip-todo      { background: #f3f4f6; color: #374151; }
  &.chip-done      { background: #dcfce7; color: #15803d; }
  &.chip-delivered { background: #ccfbf1; color: #0f766e; }
  &.chip-cancelled { background: #fef3c7; color: #b45309; }
  &.chip-cash      { background: #dcfce7; color: #15803d; }
  &.chip-bank      { background: #dbeafe; color: #1d4ed8; }
  &.chip-neutral   { background: #f3f4f6; color: #374151; }
}

.grand-total-row td {
  background: #0d3d38 !important;
  color: #fff;
  border-bottom: none;
}

.grand-total-label {
  text-align: right;
  font-weight: 600;
  font-size: 13px;
  padding: 12px 14px;
}

.grand-total-value {
  text-align: right;
  font-weight: 700;
  font-size: 14px;
  padding: 12px 14px;
  white-space: nowrap;
}
</style>
