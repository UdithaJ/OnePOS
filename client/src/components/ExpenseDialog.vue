<template>
  <v-dialog v-model="dialogValue" max-width="500" @update:model-value="onDialogToggle">
    <v-card class="pa-6">
      <h3 class="mb-4">Add Expense</h3>
      <v-form ref="formRef" v-model="isValid">
        <v-select
          v-model="expenseCategoryId"
          :items="categories"
          item-title="displayName"
          item-value="_id"
          label="Expense Category"
          :rules="[(v) => !!v || 'Category is required']"
          :loading="loadingCategories"
          required
        />
        <v-text-field
          v-model.number="amount"
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          :rules="[
            (v) => (v !== null && v !== '' && !isNaN(Number(v))) || 'Amount is required',
            (v) => Number(v) > 0 || 'Amount must be greater than 0'
          ]"
          required
        />
      </v-form>
      <v-card-actions class="px-0">
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!isValid || saving" @click="onSave">
          Save
        </v-btn>
      </v-card-actions>
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
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const { getUser } = useAuth()
const { showToast } = useToast()

const categories = ref<ExpenseCategory[]>([])
const loadingCategories = ref(false)
const categoriesLoaded = ref(false)

const expenseCategoryId = ref<string | null>(null)
const amount = ref<number | null>(null)
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
    showToast('Failed to load expense categories', 'error')
  } finally {
    loadingCategories.value = false
  }
}

function resetForm() {
  expenseCategoryId.value = null
  amount.value = null
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
      sessionId: props.sessionId
    })
    showToast('Expense recorded', 'success')
    emit('saved')
    emit('update:modelValue', false)
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to record expense', 'error')
  } finally {
    saving.value = false
  }
}
</script>
