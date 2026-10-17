<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      Import Customers
    </h2>
    <p class="text-sm text-gray-500 mb-6">
      Add customers from a CSV file. Every row is checked first, and the file is
      imported only when all of it is valid — nothing is added from a file with problems.
    </p>

    <!-- Choose a file -->
    <v-card class="rounded-xl mb-6" variant="outlined">
      <div class="px-5 py-5">
        <div class="flex items-center gap-3 flex-wrap">
          <v-file-input
            v-model="chosenFile"
            label="Customers (.csv)"
            accept=".csv,text/csv"
            prepend-icon="mdi-file-delimited-outline"
            variant="outlined"
            density="compact"
            hide-details="auto"
            class="flex-1"
            style="min-width: 260px;"
            @update:model-value="onFileChosen"
          />
          <v-btn
            :disabled="!csvText || checking"
            :loading="checking"
            style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;"
            @click="checkFile"
          >Check file</v-btn>
        </div>

        <div class="text-xs text-gray-500 mt-3">
          Required columns: <strong>Title</strong> (Mr or Ms), <strong>First Name</strong> and
          <strong>Mobile Number</strong> (10 digits). Optional: Last Name, Address Line 1,
          Address Line 2, City, State, Postal Code.
          <a href="#" class="template-link" @click.prevent="downloadTemplate">Download a template</a>
        </div>

        <v-alert v-if="fileError" type="error" variant="tonal" class="mt-4" density="compact">
          {{ fileError }}
        </v-alert>
      </div>
    </v-card>

    <!-- What was found -->
    <v-card v-if="preview" class="rounded-xl mb-6" variant="outlined">
      <div class="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <h3 class="text-base font-semibold text-gray-900">
          {{ preview.total }} customer(s) in the file
        </h3>
        <v-chip v-if="preview.valid" color="teal" variant="flat" size="small">All rows valid</v-chip>
        <v-chip v-else color="error" variant="flat" size="small">{{ preview.invalid }} row(s) with problems</v-chip>
      </div>
      <v-divider />

      <div class="px-5 py-4">
        <v-alert v-if="!preview.valid" type="error" variant="tonal" density="compact" class="mb-4">
          Fix the rows marked below in the file and choose it again. Nothing will be imported until every row is valid.
        </v-alert>

        <div class="table-wrap">
          <v-table density="compact">
            <thead>
              <tr>
                <th>Line</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Address</th>
                <th>Problems</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in shownRows" :key="row.line" :class="{ 'row-invalid': row.errors.length }">
                <td class="text-gray-500">{{ row.line }}</td>
                <td>{{ [row.title, row.firstName, row.lastName].filter(Boolean).join(' ') }}</td>
                <td>{{ row.mobileNumber }}</td>
                <td class="text-gray-600">{{ address(row) }}</td>
                <td>
                  <ul v-if="row.errors.length" class="error-list">
                    <li v-for="(e, i) in row.errors" :key="i">{{ e }}</li>
                  </ul>
                  <v-icon v-else size="small" color="teal">mdi-check</v-icon>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <div v-if="hiddenCount" class="text-xs text-gray-500 mt-2">
          Showing the first {{ shownRows.length }} of {{ filteredRows.length }} rows.
        </div>

        <div class="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-gray-100 flex-wrap">
          <v-checkbox
            v-if="!preview.valid"
            v-model="onlyProblems"
            label="Show only rows with problems"
            density="compact"
            hide-details
          />
          <span v-else></span>
          <div class="flex gap-3">
            <v-btn variant="outlined" style="border-color: #d1d5db; color: #6b7280; text-transform: none;" @click="reset">
              Cancel
            </v-btn>
            <v-btn
              :disabled="!preview.valid || importing"
              :loading="importing"
              style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;"
              @click="showConfirm = true"
            >Import {{ preview.total }} customer(s)</v-btn>
          </div>
        </div>
      </div>
    </v-card>

    <v-alert v-if="importedCount !== null" type="success" variant="tonal" density="compact">
      {{ importedCount }} customer(s) imported. They are listed under Customers.
    </v-alert>

    <ConfirmationDialog v-model="showConfirm" title="Import these customers?" @confirm="runImport">
      {{ preview?.total }} new customer(s) will be added.
    </ConfirmationDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import {
  previewCustomerImport, applyCustomerImport,
  type CustomerImportPreview, type CustomerImportRow,
} from '@/services/customerImportApiService'

const ConfirmationDialog = defineAsyncComponent(() => import('./ConfirmationDialog.vue'))

const TEMPLATE =
  'Title,First Name,Last Name,Mobile Number,Address Line 1,Address Line 2,City,State,Postal Code\r\n' +
  'Mr,Sam,Silva,0771234567,12 Main Street,,Colombo,Western,00100\r\n'

// A file of thousands of customers would make the table sluggish; the counts
// above it already say how many there are.
const MAX_SHOWN = 500

const { showToast } = useToast()
const { getUser } = useAuth()

const chosenFile = ref<File | File[] | null>(null)
const csvText = ref('')
const fileError = ref('')
const preview = ref<CustomerImportPreview | null>(null)
const importedCount = ref<number | null>(null)
const checking = ref(false)
const importing = ref(false)
const showConfirm = ref(false)
const onlyProblems = ref(false)

const filteredRows = computed(() => {
  const rows = preview.value?.rows ?? []
  return onlyProblems.value ? rows.filter(r => r.errors.length) : rows
})
const shownRows = computed(() => filteredRows.value.slice(0, MAX_SHOWN))
const hiddenCount = computed(() => filteredRows.value.length - shownRows.value.length)

function address(row: CustomerImportRow) {
  return [row.addressLine1, row.addressLine2, row.city, row.state, row.postalCode].filter(Boolean).join(', ')
}

function reset() {
  chosenFile.value = null
  csvText.value = ''
  preview.value = null
  fileError.value = ''
  onlyProblems.value = false
}

async function onFileChosen(value: File | File[] | null) {
  preview.value = null
  importedCount.value = null
  fileError.value = ''
  csvText.value = ''

  const file = Array.isArray(value) ? value[0] : value
  if (!file) return

  try {
    csvText.value = await file.text()
  } catch {
    fileError.value = `"${file.name}" could not be read.`
    return
  }
  if (!csvText.value.trim()) {
    fileError.value = `"${file.name}" is empty.`
    csvText.value = ''
  }
}

async function checkFile() {
  if (!csvText.value) return
  checking.value = true
  fileError.value = ''
  try {
    preview.value = await previewCustomerImport(csvText.value, getUser()?._id)
    onlyProblems.value = !preview.value.valid
  } catch (err: any) {
    preview.value = null
    fileError.value = err?.response?.data?.message || 'The file could not be checked.'
  } finally {
    checking.value = false
  }
}

async function runImport() {
  if (!csvText.value) return
  importing.value = true
  try {
    const result = await applyCustomerImport(csvText.value, getUser()?._id)
    reset()
    importedCount.value = result.imported
    showToast(`${result.imported} customer(s) imported.`, 'success')
  } catch (err: any) {
    // A customer may have been added with a clashing mobile number since the
    // file was checked: show the fresh row-by-row result, not only a message.
    const details = err?.response?.data?.details
    if (details) {
      preview.value = details
      onlyProblems.value = true
    }
    showToast(err?.response?.data?.message || 'The customers could not be imported.', 'error')
  } finally {
    importing.value = false
  }
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'customers-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.template-link {
  color: #0f766e;
  font-weight: 600;
  margin-left: 6px;
}

.table-wrap {
  max-height: 420px;
  overflow: auto;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
}

.row-invalid td {
  background: #fef2f2;
}

.error-list {
  margin: 0;
  padding-left: 16px;
  color: #b91c1c;
  font-size: 0.8rem;
}
</style>
