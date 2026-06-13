<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      Expense Categories
    </h2>

    <BaseList
      theme="teal"
      title="Expense Category List"
      :headers="headers"
      :items="categories"
      @add="onAdd"
      @edit="onEdit"
    >
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" class="mr-2" @click="onEdit(item)"></v-btn>
        <v-btn icon="mdi-delete" size="small" color="error" @click="onDelete(item)"></v-btn>
      </template>
    </BaseList>

    <v-dialog v-model="showForm" max-width="600">
      <template #default>
        <div class="expense-cat-form-wrapper">
          <v-card class="rounded-xl overflow-hidden" style="border: none;">
            <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold">
                {{ editId ? 'Edit Expense Category' : 'Register Expense Category' }}
              </h3>
              <v-btn
                icon="mdi-close"
                size="small"
                variant="text"
                style="color: rgba(255,255,255,0.8);"
                @click="showForm = false"
              />
            </div>
            <div class="bg-white px-6 pt-6 pb-4">
              <DynamicForm
                :schema="formSchema"
                :form="form"
                :isValid="isValid"
                :onSubmit="handleSubmit"
                :hideDefaultSubmit="true"
              />
              <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <v-btn
                  variant="outlined"
                  style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
                  @click="showForm = false"
                >Cancel</v-btn>
                <v-btn
                  :disabled="!isValid"
                  style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;"
                  @click="handleSubmit"
                >Submit</v-btn>
              </div>
            </div>
          </v-card>
        </div>
      </template>
    </v-dialog>

    <ConfirmationDialog
      v-model="showDeleteConfirm"
      title="Delete Expense Category"
      @confirm="confirmDelete"
    >
      Are you sure you want to delete
      <strong>{{ toDelete ? toDelete.displayName : '' }}</strong>?
    </ConfirmationDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import BaseList from '@/components/BaseList.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'
import { useToast } from '@/composables/useToast'
import {
  getAllExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  type ExpenseCategory,
  type ExpenseCategoryPayload,
} from '@/services/expenseCategoryApiService'

const { showToast } = useToast()

const headers = [
  { title: 'Name', key: 'name', align: 'start' as const },
  { title: 'Display Name', key: 'displayName', align: 'start' as const },
  { title: 'Actions', key: 'actions', align: 'end' as const, sortable: false },
]

const categories = ref<ExpenseCategory[]>([])
const showForm = ref(false)
const showDeleteConfirm = ref(false)
const editId = ref<string | null>(null)
const toDelete = ref<ExpenseCategory | null>(null)

const formSchema = {
  fields: [
    { name: 'name', label: 'Name (internal key)', type: 'text', required: true },
    { name: 'displayName', label: 'Display Name', type: 'text', required: true },
  ],
}

const { form, isValid } = useDynamicForm(formSchema)

async function load() {
  try {
    categories.value = await getAllExpenseCategories()
  } catch {
    showToast('Failed to load expense categories', 'error')
  }
}
onMounted(load)

function resetForm() {
  form.value.name = ''
  form.value.displayName = ''
  editId.value = null
}

function onAdd() {
  resetForm()
  showForm.value = true
}

function onEdit(category: ExpenseCategory) {
  editId.value = category._id
  form.value.name = category.name
  form.value.displayName = category.displayName
  showForm.value = true
}

function onDelete(category: ExpenseCategory) {
  toDelete.value = category
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!toDelete.value) return
  const target = toDelete.value
  try {
    await deleteExpenseCategory(target._id)
    showToast('Expense category deleted', 'success')
    await load()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to delete expense category', 'error')
  } finally {
    toDelete.value = null
    showDeleteConfirm.value = false
  }
}

async function handleSubmit() {
  const payload: ExpenseCategoryPayload = {
    name: form.value.name,
    displayName: form.value.displayName,
  }
  try {
    if (editId.value) {
      await updateExpenseCategory(editId.value, payload)
      showToast('Expense category updated', 'success')
    } else {
      await createExpenseCategory(payload)
      showToast('Expense category created', 'success')
    }
    showForm.value = false
    resetForm()
    await load()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to save expense category', 'error')
  }
}
</script>
