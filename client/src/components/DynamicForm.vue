<template>
  <v-form @submit.prevent="onSubmit" class="modal-form">
    <v-row>
      <v-col cols="12" md="6" v-for="field in schema.fields" :key="field.name">
        <v-text-field
          v-if="field.type === 'text'"
          v-model="form[field.name]"
          :label="field.label"
          :required="field.required"
          class="modal-form"
        />
        <v-text-field
          v-else-if="field.type === 'number'"
          v-model="form[field.name]"
          :label="field.label"
          :type="'number'"
          :required="field.required"
          class="modal-form"
        />
        <v-text-field
          v-else-if="field.type === 'date'"
          v-model="form[field.name]"
          :label="field.label"
          :type="'date'"
          :required="field.required"
          class="modal-form"
        />
        <v-select
          v-else-if="field.type === 'select'"
          v-model="form[field.name]"
          :label="field.label"
          :items="field.options"
          item-title="label"
          item-value="value"
          :required="field.required"
          class="modal-form"
        />
        <v-autocomplete
          v-else-if="field.type === 'autoselect'"
          v-model="form[field.name]"
          :label="field.label"
          :items="field.options"
          item-title="label"
          item-value="value"
          :required="field.required"
          class="modal-form"
        />
        <!-- Add more field types as needed -->
      </v-col>
    </v-row>
    <slot name="suborders" />
    <div class="form-actions">
      <v-btn type="submit" :disabled="!isValid" color="primary" class="modal-form">Submit</v-btn>
    </div>
  </v-form>
</template>

<script lang="ts" setup>
import { toRefs } from 'vue'
import type { FormSchema } from '@/composables/useDynamicForm'

const props = defineProps<{
  schema: FormSchema
  form: Record<string, any>
  isValid: boolean
  onSubmit: () => void
}>()

const { schema, form, isValid, onSubmit } = toRefs(props)
</script>
