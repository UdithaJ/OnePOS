<template>
  <v-container>
    <h2 class="mb-4">Users</h2>
    <BaseList
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
    <v-btn color="primary" class="mt-4" @click="onAddUser">+ Add User</v-btn>

    <v-dialog v-model="showForm" max-width="700">
      <template #default>
        <v-card class="pa-6">
          <h3 class="mb-4">{{ editUserId ? 'Edit User' : 'Register User' }}</h3>
          <DynamicForm
            :schema="userFormSchema"
            :form="form"
            :isValid="true"
            :onSubmit="handleSubmit"
          />
          <v-btn variant="text" class="mt-2" @click="showForm = false">Cancel</v-btn>
        </v-card>
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
  </v-container>
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
