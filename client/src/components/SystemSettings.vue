<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      System Settings
    </h2>

    <!-- Configuration -->
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

    <!-- Bulk SMS -->
    <v-card class="rounded-xl overflow-hidden mt-8" style="border: 1px solid #e5e7eb;">
      <div class="bg-[#0d3d38] text-white px-6 py-4">
        <span class="text-base font-semibold">Bulk SMS</span>
      </div>
      <div class="bg-white px-6 py-6">
        <v-textarea
          v-model="smsMessage"
          label="Message"
          placeholder="Type your SMS message here…"
          :counter="160"
          maxlength="160"
          rows="3"
          no-resize
          variant="outlined"
          class="mb-6"
        />

        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium text-gray-700">Select Customers</span>
          <v-text-field
            v-model="customerSearch"
            placeholder="Search…"
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 220px;"
          />
        </div>

        <v-data-table
          v-model="selectedCustomers"
          :items="customers"
          :headers="customerHeaders"
          :search="customerSearch"
          item-value="_id"
          show-select
          density="compact"
          class="rounded-lg"
          style="border: 1px solid #e5e7eb;"
        />

        <div class="flex items-center justify-between mt-4">
          <span class="text-sm text-gray-500">{{ selectedCustomers.length }} customer(s) selected</span>
          <v-btn
            :disabled="selectedCustomers.length === 0 || !smsMessage.trim()"
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            @click="confirmDialog = true"
          >Send</v-btn>
        </div>
      </div>
    </v-card>

    <!-- Confirmation dialog -->
    <v-dialog v-model="confirmDialog" max-width="420">
      <v-card class="rounded-xl overflow-hidden">
        <div class="bg-[#0d3d38] text-white px-6 py-4">
          <span class="text-base font-semibold">Send SMS Confirmation</span>
        </div>
        <div class="px-6 py-5">
          <p class="text-sm text-gray-600 mb-3">
            Recipients: <strong>{{ selectedCustomers.length }} customer(s)</strong>
          </p>
          <p class="text-sm font-medium text-gray-700 mb-2">Message:</p>
          <div
            class="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap"
            style="border: 1px solid #e5e7eb;"
          >{{ smsMessage }}</div>
        </div>
        <div class="flex justify-end gap-3 px-6 pb-5">
          <v-btn
            variant="outlined"
            style="text-transform: none;"
            @click="confirmDialog = false"
          >Cancel</v-btn>
          <v-btn
            :loading="sending"
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            @click="sendSms"
          >Send Now</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { getSystemSettings, updateSystemSettings } from '@/services/systemSettingsApiService'
import { getAllCustomers } from '@/services/customerApiService'
import { sendBulkSms } from '@/services/smsApiService'

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

// Bulk SMS state
const customers = ref<any[]>([])
const selectedCustomers = ref<string[]>([])
const customerSearch = ref('')
const smsMessage = ref('')
const sending = ref(false)
const confirmDialog = ref(false)

const customerHeaders = [
  { title: 'Name', key: 'fullName', sortable: true },
  { title: 'Mobile', key: 'mobileNumber', sortable: false },
  { title: 'City', key: 'city', sortable: true },
]

async function loadCustomers() {
  try {
    const data = await getAllCustomers()
    customers.value = data.map((c: any) => ({
      ...c,
      fullName: `${c.firstName} ${c.lastName}`,
    }))
  } catch {
    showToast('Failed to load customers', 'error')
  }
}

async function sendSms() {
  sending.value = true
  try {
    const result = await sendBulkSms({
      message: smsMessage.value,
      customerIds: selectedCustomers.value,
    })
    confirmDialog.value = false
    showToast(`SMS sent to ${result.sent} customer(s)`, 'success')
    selectedCustomers.value = []
    smsMessage.value = ''
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to send SMS', 'error')
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  load()
  loadCustomers()
})
</script>
