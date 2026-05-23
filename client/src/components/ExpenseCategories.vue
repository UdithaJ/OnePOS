<template>
  <v-container>
    <h2 class="mb-4">Expense Categories</h2>
    <BaseList
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
        <v-card class="pa-6">
          <h3 class="mb-4">{{ editId ? 'Edit Expense Category' : 'Register Expense Category' }}</h3>
          <DynamicForm
            :schema="formSchema"
            :form="form"
            :isValid="isValid"
            :onSubmit="handleSubmit"
          />
          <v-btn variant="text" class="mt-2" @click="showForm = false">Cancel</v-btn>
        </v-card>
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
  </v-container>
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
