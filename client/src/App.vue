<template>
  <v-app>
    <v-main>
      <!-- First run: the database is being populated. Shown only while that is
           happening, which on every launch after the first is never. -->
      <div v-if="setupVisible" class="setup-overlay">
        <div class="setup-card">
          <h2 class="setup-title">{{ setupFailed ? 'Setup could not finish' : 'Setting up OnePOS' }}</h2>
          <p class="setup-subtitle">
            {{ setupFailed
              ? 'The application will still run, but some initial data is missing.'
              : 'Preparing the database. This only happens once.' }}
          </p>
          <v-progress-linear v-if="!setupFailed" indeterminate color="#0f766e" class="mb-4" />
          <ul class="setup-steps">
            <li v-for="step in setupSteps" :key="step.action + step.version" :class="`step-${step.status}`">
              <span class="step-name">{{ stepLabel(step.action) }}</span>
              <span class="step-detail">{{ step.detail || step.status }}</span>
            </li>
          </ul>
        </div>
      </div>

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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast, useToast } from './composables/useToast'
import { getBootstrapStatus, type BootstrapStep } from './services/bootstrapApiService'
import './styles/neomorphic.scss'

// --- first-run setup ------------------------------------------------------

const setupSteps = ref<BootstrapStep[]>([])
const setupVisible = ref(false)
const setupFailed = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined

const { showToast } = useToast()

const STEP_LABELS: Record<string, string> = {
  'seed:workflowStateMachine': 'Order workflow rules',
  'seed:systemSettings': 'System settings',
}
function stepLabel(action: string) {
  return STEP_LABELS[action] || action.replace(/^seed:/, '')
}

// Poll until setup settles. The overlay only appears if setup is actually
// running — on a normal launch the first response is already 'ready' and
// nothing is shown.
async function pollSetup() {
  try {
    const status = await getBootstrapStatus()
    setupSteps.value = status.steps

    if (status.state === 'seeding' || status.state === 'pending') {
      setupVisible.value = true
      pollTimer = setTimeout(pollSetup, 400)
      return
    }

    if (status.state === 'failed') {
      setupFailed.value = true
      setupVisible.value = true
      return
    }

    // Ready. Say so only on the launch that actually seeded something.
    if (setupVisible.value || status.justSeeded) {
      setupVisible.value = false
      if (status.justSeeded) showToast('Setup complete. OnePOS is ready to use.', 'success')
    }
  } catch {
    // The API isn't answering yet, or has no status endpoint. Neither is worth
    // blocking the app for — keep quiet and let it start.
    setupVisible.value = false
  }
}

onMounted(pollSetup)
onUnmounted(() => { if (pollTimer) clearTimeout(pollTimer) })

const toastTitle = computed(() => {
  if (toast.value.type === 'success') return toast.value.message || 'Saved successfully'
  if (toast.value.type === 'warning') return 'Warning'
  return 'Something went wrong'
})
</script>

<style scoped>
.setup-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 61, 56, 0.96);
  padding: 24px;
}

.setup-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 14px;
  padding: 28px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}

.setup-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
}

.setup-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 20px;
}

.setup-steps {
  list-style: none;
  padding: 0;
  margin: 0;
}

.setup-steps li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8125rem;
  padding: 7px 0;
  border-top: 1px solid #f3f4f6;
}

.step-name { color: #374151; }
.step-detail { color: #9ca3af; text-align: right; }
.step-failed .step-detail { color: #b45309; }
.step-applied .step-detail { color: #0f766e; }

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
