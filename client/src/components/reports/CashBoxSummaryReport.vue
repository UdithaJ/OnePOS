<template>
  <div class="report-page">
    <!-- Page Header -->
    <div class="report-header-bar">
      <div class="flex items-center gap-3">
        <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
        <h2 class="text-2xl font-semibold text-gray-900">Cash Box Summary</h2>
      </div>
      <div class="export-buttons">
        <button class="export-btn excel-btn" @click="exportToExcel(rawRows, fromDate, toDate)">
          <v-icon size="18">mdi-microsoft-excel</v-icon>
          <span>Excel file</span>
        </button>
        <button class="export-btn pdf-btn" @click="exportToPDF(rawRows, fromDate, toDate)">
          <v-icon size="18">mdi-file-pdf-box</v-icon>
          <span>PDF file</span>
        </button>
        <button class="export-btn csv-btn" @click="exportToCSV(rawRows, fromDate, toDate)">
          <v-icon size="18">mdi-file-delimited-outline</v-icon>
          <span>CSV file</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-card">
      <div class="filter-row">
        <div class="filter-field">
          <label class="filter-label">From Date</label>
          <v-text-field
            v-model="fromDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            class="filter-input"
          />
        </div>
        <div class="filter-field">
          <label class="filter-label">To Date</label>
          <v-text-field
            v-model="toDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            class="filter-input"
          />
        </div>
        <v-btn
          class="generate-btn"
          :loading="loading"
          @click="fetchReport"
        >
          Generate Report
        </v-btn>
      </div>
    </div>

    <!-- Loading -->
    <v-skeleton-loader v-if="loading" type="table-tbody" class="mt-4" />

    <!-- Error -->
    <v-alert v-if="errorMsg && !loading" type="error" class="mt-4" closable>
      {{ errorMsg }}
    </v-alert>

    <!-- Empty state -->
    <v-alert
      v-if="hasSearched && !loading && !errorMsg && rawRows.length === 0"
      type="info"
      class="mt-4"
    >
      No orders found for the selected date range.
    </v-alert>

    <!-- Report Table -->
    <div v-if="!loading && rawRows.length > 0" class="table-card">
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Order No</th>
              <th>Order Created Date</th>
              <th>Business Date</th>
              <th>Customer</th>
              <th class="num-th">Order Amount</th>
              <th class="num-th">Due Amount</th>
              <th>Payment Method</th>
              <th class="num-th">Payment Received</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rawRows" :key="`${row.orderId}-${idx}`" :class="idx % 2 === 0 ? 'row-even' : 'row-odd'">
              <td class="order-cell">{{ String(row.orderNo).padStart(4, '0') }}</td>
              <td class="date-cell">{{ formatDate(row.createdDate) }}</td>
              <td class="date-cell">{{ formatDate(row.businessDate) }}</td>
              <td class="customer-cell">{{ row.customerName }}</td>
              <td class="num-cell">{{ row.totalAmount.toLocaleString() }}</td>
              <td class="num-cell">{{ row.dueAmount > 0 ? row.dueAmount.toLocaleString() : '-' }}</td>
              <td class="method-cell">
                <span v-if="row.paymentMethod" :class="['method-chip', methodClass(row.paymentMethod)]">
                  {{ displayMethod(row.paymentMethod) }}
                </span>
                <span v-else class="null-cell">-</span>
              </td>
              <td class="num-cell">{{ row.paymentReceived != null ? row.paymentReceived.toLocaleString() : '-' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="grand-total-row">
              <td colspan="7" class="grand-total-label">Total Amount Received</td>
              <td class="grand-total-value">{{ totalAmountReceived.toLocaleString() }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useCashBoxSummaryReport, PAYMENT_METHOD_DISPLAY } from '@/composables/useCashBoxSummaryReport'
import { useCashBoxSummaryExport } from '@/composables/useCashBoxSummaryExport'

const { fromDate, toDate, rawRows, totalAmountReceived, loading, errorMsg, hasSearched, fetchReport } = useCashBoxSummaryReport()
const { exportToExcel, exportToPDF, exportToCSV } = useCashBoxSummaryExport()

function formatDate(isoString: string | null): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function displayMethod(method: string): string {
  return PAYMENT_METHOD_DISPLAY[method] ?? method
}

function methodClass(method: string): string {
  const map: Record<string, string> = {
    cash: 'method-cash',
    card: 'method-card',
    bank: 'method-bank',
    other: 'method-other',
  }
  return map[method] ?? ''
}
</script>

<style scoped lang="scss">
.report-page {
  padding: 24px;
  background: var(--main-bg, #f3f4f6);
  min-height: 100%;
}

.report-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.export-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover { opacity: 0.88; }

  &.excel-btn { background: #217346; }
  &.pdf-btn   { background: #c0392b; }
  &.csv-btn   { background: #0f766e; }
}

.filter-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-input {
  width: 180px;
}

.generate-btn {
  background: #0f766e !important;
  color: #fff !important;
  text-transform: none !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  height: 40px !important;
  padding: 0 20px !important;
}

.table-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
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
  }

  .num-th { text-align: right; }

  td {
    padding: 10px 14px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
    color: #1f2937;
  }

  .row-even td { background: #fff; }
  .row-odd td  { background: #f9fafb; }

  .order-cell    { font-weight: 600; color: #0f766e; }
  .date-cell     { white-space: nowrap; }
  .customer-cell { font-weight: 500; }
  .method-cell   { white-space: nowrap; }
  .num-cell      { text-align: right; font-variant-numeric: tabular-nums; }
  .null-cell     { color: #9ca3af; }
}

.method-chip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;

  &.method-cash  { background: #dcfce7; color: #15803d; }
  &.method-card  { background: #dbeafe; color: #1d4ed8; }
  &.method-bank  { background: #ede9fe; color: #6d28d9; }
  &.method-other { background: #f3f4f6; color: #374151; }
}

.grand-total-row {
  td {
    background: #0d3d38 !important;
    color: #fff;
    border-bottom: none;
  }
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
