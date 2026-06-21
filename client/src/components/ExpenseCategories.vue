<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      Cashflow Categories
    </h2>

    <BaseList
      theme="teal"
      title="Cashflow Category List"
      :headers="headers"
      :items="categories"
      @add="onAdd"
      @edit="onEdit"
    >
      <template #item.type="{ item }">
        <v-chip
          :color="item.type === 'inflow' ? 'teal' : 'red-darken-3'"
          size="small"
          variant="tonal"
          label
        >{{ item.type === 'inflow' ? 'Inflow' : 'Outflow' }}</v-chip>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" class="mr-2" @click="onEdit(item)" />
        <span :title="item.inUse ? 'This cash flow category is in use and cannot be deleted' : 'Delete cash flow category'" style="display:inline-block;">
          <v-btn
            icon="mdi-delete"
            size="small"
            color="error"
            @click="handleDeleteExpenseCategoryClick(item)"
            :disabled="item.inUse"
            :aria-disabled="item.inUse"
            :class="item.inUse ? 'opacity-50 cursor-not-allowed' : ''"
          />
        </span>
      </template>
    </BaseList>

    <v-dialog v-model="showForm" max-width="500">
      <v-card class="rounded-xl overflow-hidden" style="border:none;">
        <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">
            {{ editId ? 'Edit Cashflow Category' : 'Add Cashflow Category' }}
          </h3>
          <v-btn icon="mdi-close" size="small" variant="text"
            style="color:rgba(255,255,255,0.8);" @click="showForm = false" />
        </div>
        <div class="bg-white px-6 pt-5 pb-4">
          <div class="mb-4">
            <label class="field-label">Display Name <span class="req">*</span></label>
            <v-text-field
              v-model="form.displayName"
              variant="outlined"
              density="compact"
              hide-details="auto"
              placeholder="e.g. Petty Cash"
            />
          </div>
          <div class="mb-5">
            <label class="field-label">Type <span class="req">*</span></label>
            <v-radio-group v-model="form.type" inline hide-details class="mt-1">
              <v-radio label="Inflow" value="inflow" color="#0f766e" />
              <v-radio label="Outflow" value="outflow" color="#7f1d1d" />
            </v-radio-group>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <v-btn variant="outlined"
              style="border-color:#d1d5db;color:#6b7280;text-transform:none;"
              @click="showForm = false">Cancel</v-btn>
            <v-btn :disabled="!formValid"
              style="background:#0f766e;color:#fff;text-transform:none;font-weight:600;"
              @click="handleSubmit">Submit</v-btn>
          </div>
        </div>
      </v-card>
    </v-dialog>

    <ConfirmationDialog
      v-model="showDeleteConfirm"
      title="Delete Cashflow Category"
      @confirm="confirmDelete"
    >
      Are you sure you want to delete
      <strong>{{ toDelete?.displayName }}</strong>?
    </ConfirmationDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted } from 'vue'
import BaseList from '@/components/BaseList.vue'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
import { useToast } from '@/composables/useToast'
import {
  getAllExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  type ExpenseCategory,
} from '@/services/expenseCategoryApiService'

const { showToast } = useToast()

const headers = [
  { title: 'Display Name', key: 'displayName', align: 'start' as const },
  { title: 'Type', key: 'type', align: 'start' as const },
  { title: 'Actions', key: 'actions', align: 'end' as const, sortable: false },
]

const categories = ref<ExpenseCategory[]>([])
const showForm = ref(false)
const showDeleteConfirm = ref(false)
const editId = ref<string | null>(null)
const toDelete = ref<ExpenseCategory | null>(null)

const form = reactive({ displayName: '', type: '' })
const formValid = computed(() =>
  !!(form.displayName.trim() && (form.type === 'inflow' || form.type === 'outflow'))
)

function generateName(displayName: string): string {
  return displayName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_')
}

async function load() {
  try {
    categories.value = await getAllExpenseCategories()
  } catch {
    showToast('Failed to load cashflow categories', 'error')
  }
}
onMounted(load)

function resetForm() {
  form.displayName = ''
  form.type = ''
  editId.value = null
}

function onAdd() {
  resetForm()
  showForm.value = true
}

function onEdit(category: ExpenseCategory) {
  editId.value = category._id
  form.displayName = category.displayName
  form.type = category.type ?? 'outflow'
  showForm.value = true
}

function onDelete(category: ExpenseCategory) {
  toDelete.value = category
  showDeleteConfirm.value = true
}

function handleDeleteExpenseCategoryClick(category: ExpenseCategory) {
  if (category.inUse) return
  onDelete(category)
}

async function confirmDelete() {
  if (!toDelete.value) return
  if (toDelete.value.inUse) {
    showToast('This cash flow category is in use and cannot be deleted', 'warning')
    toDelete.value = null
    showDeleteConfirm.value = false
    return
  }
  try {
    await deleteExpenseCategory(toDelete.value._id)
    showToast('Cashflow category deleted', 'success')
    await load()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to delete', 'error')
  } finally {
    toDelete.value = null
    showDeleteConfirm.value = false
  }
}

async function handleSubmit() {
  if (!formValid.value) return
  try {
    const payload = {
      name: generateName(form.displayName),
      displayName: form.displayName,
      type: form.type as 'inflow' | 'outflow',
    }
    if (editId.value) {
      await updateExpenseCategory(editId.value, payload)
      showToast('Cashflow category updated', 'success')
    } else {
      await createExpenseCategory(payload)
      showToast('Cashflow category created', 'success')
    }
    showForm.value = false
    resetForm()
    await load()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to save cashflow category', 'error')
  }
}
</script>

<style scoped>
.field-label { display: block; font-size: 0.8125rem; font-weight: 500; color: #374151; margin-bottom: 4px; }
.req { color: #ef4444; margin-left: 2px; }
</style>
