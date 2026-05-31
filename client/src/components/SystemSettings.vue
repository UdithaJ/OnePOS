<template>
  <v-container>
    <h2 class="mb-4">System Settings</h2>
    <v-card class="pa-6" max-width="600">
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
        />
        <v-text-field
          v-model.number="dueSoonLeadDays"
          label="Due-Soon Warning Lead (days)"
          type="number"
          min="0"
          :rules="[v => v === null || v === '' || Number(v) >= 0 || 'Must be 0 or greater']"
          hint="Orders due within this many days are flagged 'Due Soon'. 0 = warn only when due today; 1 = today + tomorrow; etc."
          persistent-hint
        />
        <v-btn class="mt-4" color="primary" type="submit" :loading="saving">Save</v-btn>
      </v-form>
    </v-card>
  </v-container>
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
