<template>
  <div class="report-page">
    <div class="report-header-bar">
      <div class="flex items-center gap-3">
        <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
        <h2 class="text-2xl font-semibold text-gray-900">{{ title }}</h2>
      </div>
      <div v-if="envelope && envelope.rows.length" class="export-buttons">
        <button class="export-btn excel-btn" @click="exportToExcel(envelope, paramValues)">
          <v-icon size="18">mdi-microsoft-excel</v-icon>
          <span>Excel file</span>
        </button>
        <button class="export-btn pdf-btn" @click="exportToPDF(envelope, paramValues)">
          <v-icon size="18">mdi-file-pdf-box</v-icon>
          <span>PDF file</span>
        </button>
        <button class="export-btn csv-btn" @click="exportToCSV(envelope, paramValues)">
          <v-icon size="18">mdi-file-delimited-outline</v-icon>
          <span>CSV file</span>
        </button>
      </div>
    </div>

    <!-- A bad /reports/:reportId used to 404 at the router; now the route
         always matches, so an unknown id is caught here instead. -->
    <v-alert v-if="catalogLoaded && !spec" type="warning">
      No report named "{{ reportId }}" exists.
    </v-alert>

    <ReportFilterBar
      v-else
      v-model="paramValues"
      :params="params"
      :options-for="optionsFor"
      :loading="loading"
      @generate="fetchReport"
    />

    <v-skeleton-loader v-if="loading" type="table-tbody" class="mt-4" />

    <v-alert v-if="errorMsg && !loading" type="error" class="mt-4" closable>
      {{ errorMsg }}
    </v-alert>

    <v-alert v-if="isEmpty" type="info" class="mt-4">
      {{ emptyMessage }}
    </v-alert>

    <ReportTable v-if="!loading && envelope && envelope.rows.length > 0" :envelope="envelope" />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ReportFilterBar from './ReportFilterBar.vue'
import ReportTable from './ReportTable.vue'
import { useReport } from '@/composables/useReport'
import { useReportExport } from '@/composables/useReportExport'

// One component serves every report; which one is decided by the route param
// and answered entirely by the backend definition.
const route = useRoute()
const reportId = computed(() => String(route.params.reportId))

const {
  spec,
  catalogLoaded,
  title,
  params,
  paramValues,
  optionsFor,
  envelope,
  loading,
  errorMsg,
  isEmpty,
  emptyMessage,
  fetchReport,
  initialise,
} = useReport(() => reportId.value)

const { exportToExcel, exportToPDF, exportToCSV } = useReportExport()

onMounted(initialise)
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
</style>
