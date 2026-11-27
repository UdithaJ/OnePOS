<template>
  <v-dialog :model-value="modelValue" max-width="440" @update:model-value="emit('update:modelValue', $event)">
    <v-card v-if="campaign" class="rounded-xl overflow-hidden pos-dialog">
      <div class="pos-dialog__header bg-[#0d3d38] text-white px-6 py-4">
        <span class="text-base font-semibold">Delete campaign?</span>
      </div>
      <div class="pos-dialog__body px-6 py-5 text-sm text-gray-700">
        <p class="mb-3">
          <strong>{{ campaign.name }}</strong> and its history for
          {{ campaign.counts.total.toLocaleString() }} customer(s) will be removed permanently.
          This cannot be undone.
        </p>
        <p v-if="unsent" class="mb-3">
          The {{ unsent.toLocaleString() }} customer(s) not yet sent to will not get this SMS.
        </p>
        <p class="text-gray-500">SMS already sent are not affected. Export the CSV first if you need a record.</p>
      </div>
      <div class="pos-dialog__actions">
        <v-btn variant="outlined" style="text-transform: none;" @click="emit('update:modelValue', false)">Keep</v-btn>
        <v-btn color="red" :loading="deleting" style="text-transform: none; font-weight: 600;" @click="remove">Delete</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { deleteCampaign, type SmsCampaign } from '@/services/smsApiService'

const props = defineProps<{ modelValue: boolean; campaign: SmsCampaign | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'deleted', id: string): void }>()

const { showToast } = useToast()
const deleting = ref(false)

const unsent = computed(() => {
  const c = props.campaign?.counts
  return c ? c.pending + c.retrying : 0
})

async function remove() {
  if (!props.campaign) return
  deleting.value = true
  try {
    await deleteCampaign(props.campaign._id)
    showToast('Campaign deleted', 'success')
    emit('update:modelValue', false)
    emit('deleted', props.campaign._id)
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to delete the campaign', 'error')
  } finally {
    deleting.value = false
  }
}
</script>
