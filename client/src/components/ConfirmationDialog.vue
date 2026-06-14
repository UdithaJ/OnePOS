<template>
  <v-dialog v-model="dialogValue" max-width="400">
    <v-card class="rounded-xl overflow-hidden" style="border: none;">
      <div class="bg-[#0d3d38] text-white px-6 py-4">
        <span class="text-base font-semibold">{{ title }}</span>
      </div>
      <v-card-text class="bg-white pt-4 text-gray-700">
        <slot />
      </v-card-text>
      <v-card-actions class="bg-white pb-4 px-4">
        <v-spacer />
        <v-btn
          variant="outlined"
          style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
          @click="cancel"
        >Cancel</v-btn>
        <v-btn
          style="background: #0f766e; color: #ffffff; text-transform: none;"
          @click="confirm"
        >Confirm</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { defineProps, defineEmits, computed } from 'vue'
const props = defineProps({
  modelValue: Boolean,
  title: String
})
const emit = defineEmits(['update:modelValue', 'confirm'])
const dialogValue = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})
function cancel() {
  emit('update:modelValue', false)
}
function confirm() {
  emit('confirm')
  emit('update:modelValue', false)
}
</script>
