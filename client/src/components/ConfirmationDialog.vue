<template>
  <v-dialog v-model="dialogValue" max-width="400">
    <v-card>
      <v-card-title class="text-h6">{{ title }}</v-card-title>
      <v-card-text>
        <slot />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="grey" text @click="cancel">Cancel</v-btn>
        <v-btn color="primary" @click="confirm">Confirm</v-btn>
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
