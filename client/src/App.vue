<template>
  <v-app>
    <v-main>
      <router-view />

      <!-- Toast notification -->
      <Transition name="toast">
        <div v-if="toast.show" class="toast-wrapper">
          <div class="toast-card" :class="`toast-${toast.type}`">
            <!-- Icon -->
            <div class="toast-icon" :class="`toast-icon-${toast.type}`">
              <svg v-if="toast.type === 'success'" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </div>

            <!-- Content -->
            <div class="toast-content">
              <div class="toast-title">{{ toastTitle }}</div>
              <div v-if="toast.type !== 'success'" class="toast-message">{{ toast.message }}</div>
            </div>

            <!-- Close -->
            <button class="toast-close" @click="toast.show = false">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { toast } from './composables/useToast'
import './styles/neomorphic.scss'

const toastTitle = computed(() => {
  if (toast.value.type === 'success') return toast.value.message || 'Saved successfully'
  if (toast.value.type === 'warning') return 'Warning'
  return 'Something went wrong'
})
</script>

<style scoped>
.toast-wrapper {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  min-width: 300px;
  max-width: 380px;
}

.toast-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(4px);
}

.toast-success {
  background: rgba(240, 253, 250, 0.5);
  border: 1px solid rgba(20, 184, 166, 0.3);
}

.toast-error {
  background: rgba(255, 247, 237, 0.5);
  border: 1px solid rgba(180, 83, 9, 0.3);
}

.toast-warning {
  background: rgba(255, 247, 237, 0.5);
  border: 1px solid rgba(180, 83, 9, 0.3);
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
}

.toast-icon-success { background: #14b8a6; }
.toast-icon-error   { background: #b45309; }
.toast-icon-warning { background: #b45309; }

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

.toast-message {
  font-size: 0.8125rem;
  color: #6b7280;
  margin-top: 3px;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 2px;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 1px;
}
.toast-close:hover { color: #374151; }

/* Transition */
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from  { opacity: 0; transform: translateX(-50%) translateY(-24px); }
.toast-leave-to    { opacity: 0; transform: translateX(-50%) translateY(-24px); }
</style>
