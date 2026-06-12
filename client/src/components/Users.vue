<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      Users
    </h2>

    <BaseList
      theme="teal"
      title="User List"
      :headers="userHeaders"
      :items="users"
      @add="onAddUser"
      @edit="onEditUser"
    >
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" class="mr-2" @click="onEditUser(item)"></v-btn>
        <v-btn icon="mdi-delete" size="small" color="error" @click="onDeleteUser(item)"></v-btn>
      </template>
    </BaseList>

    <v-dialog v-model="showForm" max-width="700">
      <template #default>
        <div class="user-form-wrapper">
          <v-card class="rounded-xl overflow-hidden" style="border: none;">
            <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold">
                {{ editUserId ? 'Edit User' : 'Register User' }}
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
                :schema="userFormSchema"
                :form="form"
                :isValid="true"
                :onSubmit="handleSubmit"
              />
              <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <v-btn
                  variant="outlined"
                  style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
                  @click="showForm = false"
                >Cancel</v-btn>
              </div>
            </div>
          </v-card>
        </div>
      </template>
    </v-dialog>

    <ConfirmationDialog
      v-model="showDeleteConfirm"
      title="Delete User"
      @confirm="confirmDelete"
    >
      Are you sure you want to delete
      <strong>{{ userToDelete ? userToDelete.firstName + ' ' + userToDelete.lastName : '' }}</strong>?
    </ConfirmationDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import BaseList from '@/components/BaseList.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'
import { useToast } from '@/composables/useToast'
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  type User,
  type UserPayload,
} from '@/services/userApiService'

const { showToast } = useToast()

const USER_ROLES = [
  { label: 'Admin', value: 'admin' },
  { label: 'Cashier', value: 'cashier' },
]

const userHeaders = [
  { title: 'First Name', key: 'firstName', align: 'start' as const },
  { title: 'Last Name', key: 'lastName', align: 'start' as const },
  { title: 'Username', key: 'userName', align: 'start' as const },
  { title: 'Role', key: 'userRole', align: 'start' as const },
  { title: 'Actions', key: 'actions', align: 'end' as const, sortable: false },
]

const users = ref<User[]>([])
const showForm = ref(false)
const showDeleteConfirm = ref(false)
const editUserId = ref<string | null>(null)
const userToDelete = ref<User | null>(null)

const userFormSchema = computed(() => ({
  fields: [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'userName', label: 'Username', type: 'text', required: true },
    { name: 'userRole', label: 'Role', type: 'select', required: true, options: USER_ROLES },
    {
      name: 'password',
      label: editUserId.value ? 'New Password (leave blank to keep)' : 'Password',
      type: 'password',
      required: !editUserId.value,
    },
    {
      name: 'confirmPassword',
      label: 'Confirm Password',
      type: 'password',
      required: !editUserId.value,
    },
  ],
}))

const { form } = useDynamicForm({ fields: [] })
resetForm()

async function loadUsers() {
  try {
    users.value = await getAllUsers()
  } catch {
    showToast('Failed to load users', 'error')
  }
}
onMounted(loadUsers)

function resetForm() {
  form.value.firstName = ''
  form.value.lastName = ''
  form.value.userName = ''
  form.value.userRole = ''
  form.value.password = ''
  form.value.confirmPassword = ''
  editUserId.value = null
}

function onAddUser() {
  resetForm()
  showForm.value = true
}

function onEditUser(user: User) {
  editUserId.value = user._id
  form.value.firstName = user.firstName
  form.value.lastName = user.lastName
  form.value.userName = user.userName
  form.value.userRole = user.userRole
  form.value.password = ''
  form.value.confirmPassword = ''
  showForm.value = true
}

function onDeleteUser(user: User) {
  userToDelete.value = user
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!userToDelete.value) return
  const target = userToDelete.value
  try {
    await deleteUser(target._id)
    showToast('User deleted', 'success')
    await loadUsers()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to delete user', 'error')
  } finally {
    userToDelete.value = null
    showDeleteConfirm.value = false
  }
}

async function handleSubmit() {
  const required: Array<keyof typeof form.value> = ['firstName', 'lastName', 'userName', 'userRole']
  if (!editUserId.value) required.push('password', 'confirmPassword')
  for (const key of required) {
    if (!form.value[key as string]) {
      showToast('Please fill in all required fields', 'warning')
      return
    }
  }
  if (form.value.password && form.value.password !== form.value.confirmPassword) {
    showToast('Passwords do not match', 'warning')
    return
  }

  const payload: Partial<UserPayload> = {
    firstName: form.value.firstName,
    lastName: form.value.lastName,
    userName: form.value.userName,
    userRole: form.value.userRole,
  }
  if (form.value.password) payload.password = form.value.password

  try {
    if (editUserId.value) {
      await updateUser(editUserId.value, payload)
      showToast('User updated', 'success')
    } else {
      await createUser(payload as UserPayload)
      showToast('User created', 'success')
    }
    showForm.value = false
    resetForm()
    await loadUsers()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to save user', 'error')
  }
}
</script>
