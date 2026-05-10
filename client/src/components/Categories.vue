<template>
  <v-container>
    <h2 class="mb-4">Categories</h2>
    <BaseList
      title="Category List"
      :headers="categoryHeaders"
      :items="categories"
      @add="onAddCategory"
      @edit="onEditCategory"
    >
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" class="mr-2" @click="onEditCategory(item)"></v-btn>
        <v-btn icon="mdi-delete" size="small" color="error" @click="onDeleteCategory(item)"></v-btn>
      </template>
    </BaseList>

    <v-dialog v-model="showForm" max-width="600">
      <template #default>
        <v-card class="pa-6">
          <h3 class="mb-4">{{ editCategoryId ? 'Edit Category' : 'Register Category' }}</h3>
          <DynamicForm
            :schema="categoryFormSchema"
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
      title="Delete Category"
      @confirm="confirmDelete"
    >
      Are you sure you want to delete
      <strong>{{ categoryToDelete ? categoryToDelete.name : '' }}</strong>?
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
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
  type CategoryPayload,
} from '@/services/categoryApiService'

const { showToast } = useToast()

const categoryHeaders = [
  { title: 'Name', key: 'name', align: 'start' as const },
  { title: 'Minimum Price', key: 'minimumPrice', align: 'end' as const },
  { title: 'Unit Price', key: 'unitPrice', align: 'end' as const },
  { title: 'Actions', key: 'actions', align: 'end' as const, sortable: false },
]

const categories = ref<Category[]>([])
const showForm = ref(false)
const showDeleteConfirm = ref(false)
const editCategoryId = ref<string | null>(null)
const categoryToDelete = ref<Category | null>(null)

const categoryFormSchema = {
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'minimumPrice', label: 'Minimum Price', type: 'number', required: true },
    { name: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
  ],
}

const { form, isValid } = useDynamicForm(categoryFormSchema)

async function loadCategories() {
  try {
    categories.value = await getAllCategories()
  } catch {
    showToast('Failed to load categories', 'error')
  }
}
onMounted(loadCategories)

function resetForm() {
  form.value.name = ''
  form.value.minimumPrice = ''
  form.value.unitPrice = ''
  editCategoryId.value = null
}

function onAddCategory() {
  resetForm()
  showForm.value = true
}

function onEditCategory(category: Category) {
  editCategoryId.value = category._id
  form.value.name = category.name
  form.value.minimumPrice = String(category.minimumPrice)
  form.value.unitPrice = String(category.unitPrice)
  showForm.value = true
}

function onDeleteCategory(category: Category) {
  categoryToDelete.value = category
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!categoryToDelete.value) return
  const target = categoryToDelete.value
  try {
    await deleteCategory(target._id)
    showToast('Category deleted', 'success')
    await loadCategories()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to delete category', 'error')
  } finally {
    categoryToDelete.value = null
    showDeleteConfirm.value = false
  }
}

async function handleSubmit() {
  const payload: CategoryPayload = {
    name: form.value.name,
    minimumPrice: Number(form.value.minimumPrice),
    unitPrice: Number(form.value.unitPrice),
  }
  if (Number.isNaN(payload.minimumPrice) || Number.isNaN(payload.unitPrice)) {
    showToast('Minimum price and unit price must be numbers', 'warning')
    return
  }

  try {
    if (editCategoryId.value) {
      await updateCategory(editCategoryId.value, payload)
      showToast('Category updated', 'success')
    } else {
      await createCategory(payload)
      showToast('Category created', 'success')
    }
    showForm.value = false
    resetForm()
    await loadCategories()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to save category', 'error')
  }
}
</script>
