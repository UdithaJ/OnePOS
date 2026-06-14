<template>
  <div class="report-page">
    <!-- Page Header -->
    <div class="report-header-bar">
      <div class="flex items-center gap-3">
        <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
        <h2 class="text-2xl font-semibold text-gray-900">Returning Customers</h2>
      </div>
      <div class="export-buttons">
        <button class="export-btn excel-btn" @click="exportToExcel(rawRows)">
          <v-icon size="18">mdi-microsoft-excel</v-icon>
          <span>Excel file</span>
        </button>
        <button class="export-btn pdf-btn" @click="exportToPDF(rawRows)">
          <v-icon size="18">mdi-file-pdf-box</v-icon>
          <span>PDF file</span>
        </button>
        <button class="export-btn csv-btn" @click="exportToCSV(rawRows)">
          <v-icon size="18">mdi-file-delimited-outline</v-icon>
          <span>CSV file</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-card">
      <div class="filter-row">
        <div class="filter-field">
          <label class="filter-label">Order Count Greater Than</label>
          <v-text-field
            v-model.number="minOrderCount"
            type="number"
            min="0"
            placeholder="0"
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
      No customers found with more than {{ minOrderCount ?? 0 }} order(s).
    </v-alert>

    <!-- Report Table -->
    <div v-if="!loading && rawRows.length > 0" class="table-card">
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Mobile No</th>
              <th class="num-th">No of Orders until Today</th>
              <th class="num-th">Total No of Kilos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rawRows" :key="row.customerId" :class="idx % 2 === 0 ? 'row-even' : 'row-odd'">
              <td class="customer-cell">{{ row.customerName }}</td>
              <td class="mobile-cell">{{ row.mobileNumber }}</td>
              <td class="num-cell">{{ row.orderCount }}</td>
              <td class="num-cell">{{ row.totalWeight }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useReturningCustomersReport } from '@/composables/useReturningCustomersReport'
import { useReturningCustomersExport } from '@/composables/useReturningCustomersExport'

const { minOrderCount, rawRows, totalKilos, loading, errorMsg, hasSearched, fetchReport } = useReturningCustomersReport()
const { exportToExcel, exportToPDF, exportToCSV } = useReturningCustomersExport()
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
  width: 220px;
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

  .customer-cell { font-weight: 600; color: #0f766e; }
  .mobile-cell   { white-space: nowrap; }
  .num-cell      { text-align: right; font-variant-numeric: tabular-nums; }
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
