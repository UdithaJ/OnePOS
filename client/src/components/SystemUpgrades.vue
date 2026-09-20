<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      System Upgrades
    </h2>
    <p class="text-sm text-gray-500 mb-6">
      Apply an upgrade script to this system. Every script is checked, shown to you
      before it runs, and recorded once it has.
    </p>

    <!-- Choose a script -->
    <v-card class="rounded-xl mb-6" variant="outlined">
      <div class="px-5 py-5">
        <div class="flex items-center gap-3 flex-wrap">
          <v-file-input
            v-model="chosenFile"
            label="Upgrade script (.json)"
            accept=".json,application/json"
            prepend-icon="mdi-file-code-outline"
            variant="outlined"
            density="compact"
            hide-details="auto"
            class="flex-1"
            style="min-width: 260px;"
            @update:model-value="onFileChosen"
          />
          <v-btn
            :disabled="!script || loadingPreview"
            :loading="loadingPreview"
            style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;"
            @click="loadPreview"
          >Check script</v-btn>
        </div>

        <v-alert v-if="fileError" type="error" variant="tonal" class="mt-4" density="compact">
          {{ fileError }}
        </v-alert>
      </div>
    </v-card>

    <!-- What it would do -->
    <v-card v-if="preview" class="rounded-xl mb-6" variant="outlined">
      <div class="bg-[#0d3d38] text-white px-5 py-3">
        <h3 class="text-base font-semibold">{{ preview.action }} — version {{ preview.version }}</h3>
        <p v-if="preview.description" class="text-sm" style="color: rgba(255,255,255,0.75);">
          {{ preview.description }}
        </p>
      </div>
      <div class="px-5 py-5">
        <v-alert v-if="preview.alreadyApplied" type="warning" variant="tonal" density="compact" class="mb-4">
          This script has already been applied{{ preview.appliedAt ? ' on ' + formatDate(preview.appliedAt) : '' }}.
          Raise the version in the file if it is meant to run again.
        </v-alert>

        <div v-for="(op, i) in preview.operations" :key="i" class="op-row">
          <div class="flex items-baseline justify-between gap-3 flex-wrap">
            <span class="font-medium text-gray-900">
              <v-chip size="x-small" :color="opColor(op.op)" variant="flat" class="mr-2">{{ op.op }}</v-chip>
              {{ op.collection }}
            </span>
            <span class="text-sm text-gray-600">
              <template v-if="op.willInsert">{{ op.willInsert }} document(s) to insert</template>
              <template v-else>{{ op.matched }} document(s) match</template>
            </span>
          </div>
          <div v-if="op.note" class="text-xs mt-1" :class="isDestructive(op) ? 'text-red-700' : 'text-gray-500'">
            {{ op.note }}
          </div>
          <pre v-if="op.update" class="code-block">{{ JSON.stringify(op.update, null, 2) }}</pre>
          <details v-if="op.sample?.length" class="mt-2">
            <summary class="text-xs text-gray-500 cursor-pointer">
              {{ op.willInsert ? 'documents to insert' : 'affected documents' }} ({{ op.sample.length }} shown)
            </summary>
            <pre class="code-block">{{ JSON.stringify(op.sample, null, 2) }}</pre>
          </details>
        </div>

        <div class="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
          <v-btn variant="outlined" style="border-color: #d1d5db; color: #6b7280; text-transform: none;" @click="reset">
            Cancel
          </v-btn>
          <v-btn
            :disabled="preview.alreadyApplied || applying"
            :loading="applying"
            style="background: #b45309; color: #fff; text-transform: none; font-weight: 600;"
            @click="showConfirm = true"
          >Apply upgrade</v-btn>
        </div>
      </div>
    </v-card>

    <!-- What it did -->
    <v-card v-if="result" class="rounded-xl mb-6" variant="outlined">
      <div class="px-5 py-5">
        <v-alert
          :type="result.status === 'success' ? 'success' : 'error'"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ result.detail }}
        </v-alert>
        <v-alert v-if="result.partiallyApplied" type="warning" variant="tonal" density="compact" class="mb-3">
          Some operations ran before the failure and have not been undone — there is no
          rollback. Check the data before running anything else.
        </v-alert>
        <pre class="code-block">{{ JSON.stringify(result.results, null, 2) }}</pre>
      </div>
    </v-card>

    <!-- What has been done to this system -->
    <v-card class="rounded-xl" variant="outlined">
      <div class="px-5 py-4 flex items-center justify-between">
        <h3 class="text-base font-semibold text-gray-900">History</h3>
        <v-btn variant="text" size="small" :loading="loadingHistory" style="color:#0f766e; text-transform:none;" @click="loadHistory">
          Refresh
        </v-btn>
      </div>
      <v-divider />
      <div v-if="!history.length" class="px-5 py-6 text-sm text-gray-500">Nothing recorded yet.</div>
      <div v-for="entry in history" :key="entry._id" class="history-row">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <span class="font-medium text-gray-900">
            {{ entry.action }} <span class="text-gray-400">v{{ entry.version }}</span>
          </span>
          <span class="text-xs text-gray-500">{{ formatDate(entry.runAt) }}</span>
        </div>
        <div class="text-sm mt-1" :class="entry.status === 'success' ? 'text-gray-600' : 'text-red-700'">
          <v-chip size="x-small" :color="entry.status === 'success' ? 'teal' : 'error'" variant="flat" class="mr-2">
            {{ entry.status }}
          </v-chip>
          <v-chip v-if="entry.isUpgrade" size="x-small" variant="outlined" class="mr-2">upgrade</v-chip>
          {{ entry.detail }}
        </div>
      </div>
    </v-card>

    <ConfirmationDialog v-model="showConfirm" title="Apply this upgrade?" @confirm="runUpgrade">
      <strong>{{ preview?.action }}</strong> will change data in this system.
      <span v-if="destructiveCount">
        {{ destructiveCount }} operation(s) delete documents permanently.
      </span>
      There is no rollback.
    </ConfirmationDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import {
  previewUpgrade, applyUpgrade, getUpgradeHistory,
  type UpgradePreview, type UpgradeResult, type HistoryEntry, type UpgradeOperationPreview,
} from '@/services/upgradeApiService'

const ConfirmationDialog = defineAsyncComponent(() => import('./ConfirmationDialog.vue'))

const { showToast } = useToast()
const { getUser } = useAuth()

const chosenFile = ref<File | File[] | null>(null)
const script = ref<any>(null)
const fileError = ref('')
const preview = ref<UpgradePreview | null>(null)
const result = ref<UpgradeResult | null>(null)
const history = ref<HistoryEntry[]>([])
const loadingPreview = ref(false)
const loadingHistory = ref(false)
const applying = ref(false)
const showConfirm = ref(false)

const destructiveCount = computed(
  () => preview.value?.operations.filter(o => o.op.startsWith('delete') && o.matched > 0).length ?? 0,
)

function isDestructive(op: UpgradeOperationPreview) {
  return op.op.startsWith('delete') && op.matched > 0
}

function opColor(op: string) {
  if (op.startsWith('insert')) return 'teal'
  if (op.startsWith('update')) return 'blue-grey'
  return 'error'
}

function formatDate(value: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB')
}

function reset() {
  chosenFile.value = null
  script.value = null
  preview.value = null
  result.value = null
  fileError.value = ''
}

// The file is read here rather than uploaded: it is JSON, so the parsed object
// posts as an ordinary request body and the server never handles a file.
async function onFileChosen(value: File | File[] | null) {
  preview.value = null
  result.value = null
  fileError.value = ''
  script.value = null

  const file = Array.isArray(value) ? value[0] : value
  if (!file) return

  // Reading and parsing are reported separately, and the parser's own message
  // is passed through: "not valid JSON" on its own leaves you guessing at which
  // character the file went wrong.
  let text: string
  try {
    text = await file.text()
  } catch {
    fileError.value = `"${file.name}" could not be read.`
    return
  }

  if (!text.trim()) {
    fileError.value = `"${file.name}" is empty.`
    return
  }

  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fileError.value = 'An upgrade script must be a JSON object, starting with {.'
      return
    }
    script.value = parsed
  } catch (err: any) {
    // JSON has no comments and no trailing commas, which is what trips up a
    // script pasted from documentation.
    const hint = /\/\//.test(text) || /\/\*/.test(text)
      ? ' JSON does not allow // or /* */ comments — remove them.'
      : /,\s*[}\]]/.test(text)
        ? ' There is a comma before a } or ] — JSON does not allow trailing commas.'
        : ''
    fileError.value = `"${file.name}" is not valid JSON: ${err?.message || 'could not be parsed'}.${hint}`
  }
}

async function loadPreview() {
  if (!script.value) return
  loadingPreview.value = true
  fileError.value = ''
  try {
    preview.value = await previewUpgrade(script.value, getUser()?._id)
  } catch (err: any) {
    preview.value = null
    fileError.value = err?.response?.data?.message || 'The script could not be checked.'
  } finally {
    loadingPreview.value = false
  }
}

async function runUpgrade() {
  if (!script.value) return
  applying.value = true
  try {
    result.value = await applyUpgrade(script.value, getUser()?._id)
    preview.value = null
    showToast(
      result.value.status === 'success' ? 'Upgrade applied.' : 'The upgrade did not finish.',
      result.value.status === 'success' ? 'success' : 'error',
    )
    await loadHistory()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'The upgrade could not be applied.', 'error')
  } finally {
    applying.value = false
  }
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    history.value = await getUpgradeHistory(getUser()?._id)
  } catch {
    // The history is context, not the job — a failure here is not worth a toast.
    history.value = []
  } finally {
    loadingHistory.value = false
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.op-row {
  padding: 12px 0;
  border-top: 1px solid #f3f4f6;
}
.op-row:first-of-type { border-top: none; }

.history-row {
  padding: 12px 20px;
  border-top: 1px solid #f3f4f6;
}
.history-row:first-of-type { border-top: none; }

.code-block {
  margin-top: 6px;
  padding: 10px 12px;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.5;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
