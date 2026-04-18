<template>
  <v-app>
    <v-main style="background: #f5f5f5;">
      <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
        <v-card class="pa-8" width="400" elevation="4">
          <v-card-title class="text-h5 mb-4 text-center">Sign In</v-card-title>
          <v-form @submit.prevent="handleLogin">
            <v-text-field
              v-model="userName"
              label="Username"
              prepend-inner-icon="mdi-account"
              required
              :disabled="loading"
              class="mb-2"
            />
            <v-text-field
              v-model="password"
              label="Password"
              prepend-inner-icon="mdi-lock"
              :type="showPassword ? 'text' : 'password'"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
              required
              :disabled="loading"
              class="mb-4"
            />
            <v-alert v-if="error" type="error" class="mb-4" density="compact">{{ error }}</v-alert>
            <v-btn
              type="submit"
              color="primary"
              block
              :loading="loading"
              :disabled="!userName || !password"
            >
              Sign In
            </v-btn>
          </v-form>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '@/services/authApiService'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { setUser } = useAuth()

const userName = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const result = await login({ userName: userName.value, password: password.value })
    setUser(result.user)
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>
