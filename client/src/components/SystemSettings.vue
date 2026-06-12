<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      System Settings
    </h2>

    <v-card class="rounded-xl overflow-hidden max-w-lg" style="border: 1px solid #e5e7eb;">
      <div class="bg-[#0d3d38] text-white px-6 py-4">
        <span class="text-base font-semibold">Configuration</span>
      </div>
      <div class="bg-white px-6 py-6">
        <v-form @submit.prevent="save">
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
          <div class="flex justify-end mt-6">
            <v-btn
              type="submit"
              :loading="saving"
              style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            >Save Settings</v-btn>
          </div>
        </v-form>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import {
  getSystemSettings,
  updateSystemSettings,
} from '@/services/systemSettingsApiService'

const { showToast } = useToast()

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
onMounted(load)

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
</script>
