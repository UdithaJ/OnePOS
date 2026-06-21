<template>
  <v-form @submit.prevent="onSubmit" class="modal-form">
    <slot />
    <v-row dense>
      <v-col cols="12" md="6" v-for="field in schema.fields" :key="field.name">
        <div class="field-group">
          <label class="field-label">
            {{ field.label }}<span v-if="field.required" class="required-star">*</span>
          </label>
          <v-text-field
            v-if="field.type === 'text'"
            v-model="form[field.name]"
            :placeholder="field.label"
            :required="field.required"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-text-field
            v-else-if="field.type === 'number'"
            v-model="form[field.name]"
            :placeholder="field.label"
            :type="'number'"
            :required="field.required"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-text-field
            v-else-if="field.type === 'date'"
            v-model="form[field.name]"
            :type="'date'"
            :required="field.required"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-text-field
            v-else-if="field.type === 'password'"
            v-model="form[field.name]"
            :placeholder="field.label"
            :type="passwordVisibility[field.name] ? 'text' : 'password'"
            :append-inner-icon="passwordVisibility[field.name] ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="passwordVisibility[field.name] = !passwordVisibility[field.name]"
            :required="field.required"
            autocomplete="new-password"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-select
            v-else-if="field.type === 'select'"
            v-model="form[field.name]"
            :placeholder="field.label"
            :items="field.options"
            item-title="label"
            item-value="value"
            :required="field.required"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-autocomplete
            v-else-if="field.type === 'autoselect'"
            v-model="form[field.name]"
            :placeholder="field.label"
            :items="field.options"
            item-title="label"
            item-value="value"
            :required="field.required"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
        </div>
      </v-col>
    </v-row>
    <slot name="suborders" />
    <div class="form-actions" v-if="!hideDefaultSubmit">
      <v-btn type="submit" :disabled="!isValid"
        style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;">Submit</v-btn>
    </div>
  </v-form>
</template>

<script lang="ts" setup>
import { reactive, toRefs } from 'vue'
import type { FormSchema } from '@/composables/useDynamicForm'

const props = defineProps<{
  schema: FormSchema
  form: Record<string, any>
  isValid: boolean
  onSubmit: () => void
  hideDefaultSubmit?: boolean
}>()

const { schema, form, isValid, onSubmit, hideDefaultSubmit } = toRefs(props)
const passwordVisibility = reactive<Record<string, boolean>>({})
</script>

<style scoped>
.field-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}
.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
}
.required-star {
  color: #ef4444;
  margin-left: 2px;
}
</style>
