<template>
  <!-- The page fills the screen below the app bar and above the on-screen
       keyboard (--osk-h while it is open). The card scrolls on its own, with
       Save Settings pinned at the bottom. -->
  <div class="settings-page p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3" style="flex: none;">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      System Settings
    </h2>

    <div class="flex gap-6" style="flex: 1 1 auto; min-height: 0;">
    <!-- Configuration -->
    <v-card class="rounded-xl overflow-hidden pos-dialog" style="border: 1px solid #e5e7eb; min-width: 380px; width: 420px; flex-shrink: 0;">
      <div class="pos-dialog__header bg-[#0d3d38] text-white px-6 py-4">
        <span class="text-base font-semibold">Configuration</span>
      </div>
      <v-form class="pos-dialog" style="flex: 1 1 auto;" @submit.prevent="save">
        <div class="pos-dialog__body px-6 py-6">
          <v-text-field
            v-model.number="dailyCapacityKg"
            label="Daily Processing Capacity (kg)"
            type="number"
            min="0"
            :rules="[v => v === null || v === '' || Number(v) >= 0 || 'Must be 0 or greater']"
            hint="Maximum total kilograms the laundry can process per day. Set 0 to disable the capacity check."
            persistent-hint
            class="mb-6"
            variant="outlined"
          />
          <v-text-field
            v-model.number="dueSoonLeadDays"
            label="Due-Soon Warning Lead (days)"
            type="number"
            min="0"
            :rules="[v => v === null || v === '' || Number(v) >= 0 || 'Must be 0 or greater']"
            hint="Orders due within this many days are flagged 'Due Soon'. 0 = warn only when due today; 1 = today + tomorrow; etc."
            persistent-hint
            variant="outlined"
          />
        </div>
        <div class="pos-dialog__actions">
          <v-btn
            type="submit"
            :loading="saving"
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
          >Save Settings</v-btn>
        </div>
      </v-form>
    </v-card>

    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { getSystemSettings, updateSystemSettings } from '@/services/systemSettingsApiService'

const { showToast } = useToast()

// Configuration state
const dailyCapacityKg = ref<number>(0)
const dueSoonLeadDays = ref<number>(1)
const saving = ref(false)

async function load() {
  try {
    const settings = await getSystemSettings()
    dailyCapacityKg.value = Number(settings.dailyCapacityKg) || 0
    dueSoonLeadDays.value = Number(settings.dueSoonLeadDays) || 0
  } catch {
    showToast('Failed to load system settings', 'error')
  }
}

async function save() {
  saving.value = true
  try {
    const updated = await updateSystemSettings({
      dailyCapacityKg: Number(dailyCapacityKg.value) || 0,
      dueSoonLeadDays: Number(dueSoonLeadDays.value) || 0,
    })
    dailyCapacityKg.value = Number(updated.dailyCapacityKg) || 0
    dueSoonLeadDays.value = Number(updated.dueSoonLeadDays) || 0
    showToast('System settings saved', 'success')
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to save system settings', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px) - var(--osk-h, 0px));
  box-sizing: border-box;
}
</style>
