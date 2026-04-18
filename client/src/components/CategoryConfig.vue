<template>
  <v-container>
    <h2 class="mb-4">Category Config</h2>
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between flex-wrap gap-2">
        <span>Pricing categories</span>
        <v-btn color="primary" @click="openCreate">Add category</v-btn>
      </v-card-title>
      <v-data-table
        :headers="headers"
        :items="categories"
        :loading="loading"
        class="elevation-0"
      >
        <template #item.pricePerKg="{ item }">
          {{ formatMoney(item.pricePerKg) }}
        </template>
        <template #item.minPrice="{ item }">
          {{ formatMoney(item.minPrice) }}
        </template>
        <template #item.isActive="{ item }">
          <v-chip :color="item.isActive ? 'success' : 'default'" size="small">
            {{ item.isActive ? 'Active' : 'Disabled' }}
          </v-chip>
        </template>
        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
        <template #item.updatedAt="{ item }">
          {{ formatDate(item.updatedAt) }}
        </template>
        <template #item.actions="{ item }">
          <v-btn size="small" variant="text" color="primary" @click="openEdit(item)">
            Edit
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :color="item.isActive ? 'warning' : 'success'"
            @click="toggleActive(item)"
          >
            {{ item.isActive ? 'Disable' : 'Enable' }}
          </v-btn>
        </template>
        <template #no-data>
          <v-alert type="info" class="ma-4">No categories yet.</v-alert>
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="showDialog" max-width="560" persistent>
      <v-card class="pa-4">
        <v-card-title>{{ editingId ? 'Edit category' : 'Add category' }}</v-card-title>
        <v-card-text>
          <DynamicForm
            :schema="categoryFormSchema"
            :form="form"
            :isValid="formIsValid"
            :onSubmit="submitForm"
          />
          <div class="mt-2 px-1">
            <v-switch
              v-model="formIsActive"
              color="primary"
              hide-details
              label="Active"
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import DynamicForm from '@/components/DynamicForm.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'
import {
  createCategory,
  getAllCategories,
  updateCategory,
  type Category,
} from '@/services/categoryApiService'

const categoryFormSchema = {
  fields: [
    { name: 'name', label: 'Category name', type: 'text', required: true },
    { name: 'pricePerKg', label: 'Price per kg', type: 'number', required: true },
    { name: 'minPrice', label: 'Minimum charge', type: 'number', required: true },
  ],
}

const { form, isValid: baseValid } = useDynamicForm(categoryFormSchema)

const categories = ref<Category[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const formIsActive = ref(true)

const formIsValid = computed(() => {
  if (!baseValid.value) return false
  const p = Number(form.value.pricePerKg)
  const m = Number(form.value.minPrice)
  if (Number.isNaN(p) || Number.isNaN(m)) return false
  if (p < 0 || m < 0) return false
  return true
})

const headers = [
  { title: 'Name', key: 'name', align: 'start' as const },
  { title: 'Price / kg', key: 'pricePerKg', align: 'end' as const },
  { title: 'Min. charge', key: 'minPrice', align: 'end' as const },
  { title: 'Status', key: 'isActive', align: 'start' as const },
  { title: 'Created', key: 'createdAt', align: 'start' as const },
  { title: 'Updated', key: 'updatedAt', align: 'start' as const },
  { title: 'Actions', key: 'actions', align: 'start' as const, sortable: false },
]

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await getAllCategories()
  } catch {
    categories.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)

function resetForm() {
  categoryFormSchema.fields.forEach(f => {
    form.value[f.name] = ''
  })
  formIsActive.value = true
  editingId.value = null
}

function openCreate() {
  resetForm()
  showDialog.value = true
}

function openEdit(item: Category) {
  editingId.value = item._id
  form.value.name = item.name
  form.value.pricePerKg = item.pricePerKg
  form.value.minPrice = item.minPrice
  formIsActive.value = item.isActive
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  resetForm()
}

async function submitForm() {
  const payload = {
    name: String(form.value.name).trim(),
    pricePerKg: Number(form.value.pricePerKg),
    minPrice: Number(form.value.minPrice),
    isActive: formIsActive.value,
  }
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, payload)
    } else {
      await createCategory(payload)
    }
    closeDialog()
    await loadCategories()
  } catch {
    alert('Could not save category. Check values and try again.')
  }
}

async function toggleActive(item: Category) {
  try {
    await updateCategory(item._id, { isActive: !item.isActive })
    await loadCategories()
  } catch {
    alert('Could not update category status.')
  }
}
</script>
