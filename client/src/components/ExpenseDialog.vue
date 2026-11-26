<template>
  <v-dialog v-model="dialogValue" max-width="500" @update:model-value="onDialogToggle">
    <v-card class="rounded-xl overflow-hidden pos-dialog" style="border: none;">
      <div class="pos-dialog__header px-6 py-4 flex items-center justify-between"
        :style="flowType === 'inflow' ? 'background: #0d3d38;' : 'background: #0d3d38;'">
        <span class="text-white text-base font-semibold">
          {{ flowType === 'inflow' ? 'Add Cash Inflow' : 'Add Expense' }}
        </span>
        <v-btn icon="mdi-close" size="small" variant="text"
          style="color: rgba(255,255,255,0.8);" @click="close" />
      </div>
      <div class="pos-dialog__body px-6 pt-6 pb-4">
        <v-form ref="formRef" v-model="isValid">
          <v-select
            v-model="expenseCategoryId"
            :items="filteredCategories"
            item-title="displayName"
            item-value="_id"
            :label="flowType === 'inflow' ? 'Inflow Category *' : 'Expense Category *'"
            :rules="[(v) => !!v || 'Category is required']"
            :loading="loadingCategories"
            required
            variant="outlined"
            class="mb-3"
          />
          <v-text-field
            v-if="flowType === 'inflow'"
            v-model="remarks"
            label="Remarks *"
            placeholder="Bill number or remarks"
            persistent-placeholder
            :rules="[(v) => !!(v && v.trim()) || 'Bill number or Remarks required']"
            required
            variant="outlined"
            class="mb-3"
          />
          <v-text-field
            v-model.number="amount"
            label="Amount *"
            type="number"
            min="0"
            step="0.01"
            :rules="[
              (v) => (v !== null && v !== '' && !isNaN(Number(v))) || 'Amount is required',
              (v) => Number(v) > 0 || 'Amount must be greater than 0'
            ]"
            required
            variant="outlined"
          />
        </v-form>
      </div>
      <div class="pos-dialog__actions">
        <v-btn
          variant="outlined"
          :disabled="saving"
          style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
          @click="close"
        >Cancel</v-btn>
        <v-btn
          :loading="saving"
          :disabled="!isValid || saving"
          style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
          @click="onSave"
        >Save</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { getAllExpenseCategories, type ExpenseCategory } from '@/services/expenseCategoryApiService'
import { createExpense } from '@/services/expenseApiService'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  modelValue: boolean
  sessionId: string
  flowType?: 'inflow' | 'outflow'
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const { getUser } = useAuth()
const { showToast } = useToast()

const effectiveFlowType = computed(() => props.flowType ?? 'outflow')

const categories = ref<ExpenseCategory[]>([])
const filteredCategories = computed(() =>
  categories.value.filter(c => c.type === effectiveFlowType.value)
)
const loadingCategories = ref(false)
const categoriesLoaded = ref(false)

const expenseCategoryId = ref<string | null>(null)
const amount = ref<number | null>(null)
const remarks = ref('')
const isValid = ref(false)
const saving = ref(false)
const formRef = ref<any>(null)

const dialogValue = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

async function loadCategories() {
  if (categoriesLoaded.value) return
  loadingCategories.value = true
  try {
    categories.value = await getAllExpenseCategories()
    categoriesLoaded.value = true
  } catch {
    showToast('Failed to load cashflow categories', 'error')
  } finally {
    loadingCategories.value = false
  }
}

function resetForm() {
  expenseCategoryId.value = null
  amount.value = null
  remarks.value = ''
  formRef.value?.resetValidation?.()
}

function close() {
  emit('update:modelValue', false)
}

function onDialogToggle(val: boolean) {
  if (val) {
    loadCategories()
  } else {
    resetForm()
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) loadCategories()
    else resetForm()
  }
)

async function onSave() {
  if (!expenseCategoryId.value || amount.value === null) return
  const isInflow = effectiveFlowType.value === 'inflow'
  if (isInflow && !remarks.value.trim()) return
  const user = getUser()
  if (!user?._id) {
    showToast('User not authenticated', 'error')
    return
  }
  if (!props.sessionId) {
    showToast('No active cash box session', 'error')
    return
  }
  saving.value = true
  try {
    await createExpense({
      expenseType: expenseCategoryId.value,
      amount: Number(amount.value),
      userId: user._id,
      sessionId: props.sessionId,
      flowType: effectiveFlowType.value,
      ...(isInflow ? { remarks: remarks.value.trim() } : {})
    })
    showToast(effectiveFlowType.value === 'inflow' ? 'Cash inflow recorded' : 'Expense recorded', 'success')
    emit('saved')
    emit('update:modelValue', false)
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to record cashflow entry', 'error')
  } finally {
    saving.value = false
  }
}
</script>
