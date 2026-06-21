<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      Categories
    </h2>

    <BaseList
      theme="teal"
      title="Category List"
      :headers="categoryHeaders"
      :items="categories"
      @add="onAddCategory"
      @edit="onEditCategory"
    >
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" class="mr-2" @click="onEditCategory(item)"></v-btn>
        <span
          :title="item.inUse ? 'This category is in use and cannot be deleted' : 'Delete category'"
          style="display: inline-block;"
        >
          <v-btn
            icon="mdi-delete"
            size="small"
            color="error"
            @click="handleDeleteCategoryClick(item)"
            :disabled="item.inUse"
            :aria-disabled="item.inUse"
            :class="item.inUse ? 'opacity-50 cursor-not-allowed' : ''"
          ></v-btn>
        </span>
      </template>
    </BaseList>

    <v-dialog v-model="showForm" max-width="600">
      <template #default>
        <div class="category-form-wrapper">
        <v-card class="rounded-xl overflow-hidden" style="border: none;">
          <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ editCategoryId ? 'Edit Category' : 'Register Category' }}
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
              :schema="categoryFormSchema"
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
      title="Delete Category"
      @confirm="confirmDelete"
    >
      Are you sure you want to delete
      <strong>{{ categoryToDelete ? categoryToDelete.name : '' }}</strong>?
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

function handleDeleteCategoryClick(category: Category) {
  if (category.inUse) return
  onDeleteCategory(category)
}

async function confirmDelete() {
  if (!categoryToDelete.value) return
  const target = categoryToDelete.value
  if (target.inUse) {
    showToast('This category is in use and cannot be deleted', 'warning')
    categoryToDelete.value = null
    showDeleteConfirm.value = false
    return
  }
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



