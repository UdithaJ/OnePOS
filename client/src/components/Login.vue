<template>
  <v-app>
    <v-main style="background: #f3f4f6;">
      <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
        <v-card class="rounded-xl overflow-hidden" width="420" style="border: 1px solid #e5e7eb; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <div class="bg-[#0d3d38] text-white px-8 py-6 text-center">
            <div class="text-2xl font-bold tracking-wide">Softwash</div>
            <div class="text-sm mt-1" style="color: rgba(255,255,255,0.7);">Sign in to your account</div>
          </div>
          <div class="bg-white px-8 py-8">
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="userName"
                label="Username"
                prepend-inner-icon="mdi-account"
                required
                :disabled="loading"
                variant="outlined"
                class="mb-3"
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
                variant="outlined"
                class="mb-4"
              />
              <v-alert v-if="error" type="error" class="mb-4" density="compact">{{ error }}</v-alert>
              <v-btn
                type="submit"
                block
                :loading="loading"
                :disabled="!userName || !password"
                style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600; font-size: 1rem; height: 44px;"
              >
                Sign In
              </v-btn>
            </v-form>
          </div>
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
