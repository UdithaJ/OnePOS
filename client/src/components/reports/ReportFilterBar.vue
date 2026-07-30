<template>
  <div class="filter-card">
    <div class="filter-row">
      <!-- Inputs are rendered from the definition's params; no report knows
           anything about its own filters on the client. -->
      <div v-for="param in params" :key="param.name" class="filter-field">
        <label class="filter-label">{{ param.label }}</label>

        <v-select
          v-if="param.type === 'select'"
          :model-value="modelValue[param.name]"
          :items="optionsFor(param)"
          item-title="label"
          item-value="value"
          density="compact"
          variant="outlined"
          hide-details
          class="filter-input"
          :style="{ width: `${param.width ?? 180}px` }"
          @update:model-value="update(param.name, $event)"
        />

        <v-text-field
          v-else
          :model-value="modelValue[param.name]"
          :type="param.type === 'number' ? 'number' : param.type === 'date' ? 'date' : 'text'"
          :min="param.min"
          :placeholder="param.placeholder"
          density="compact"
          variant="outlined"
          hide-details
          class="filter-input"
          :style="{ width: `${param.width ?? 180}px` }"
          @update:model-value="update(param.name, coerce(param, $event))"
        />
      </div>

      <v-btn class="generate-btn" :loading="loading" @click="$emit('generate')">
        Generate Report
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { ReportParam, SelectOption } from '@/types/report'

const props = defineProps<{
  params: ReportParam[]
  modelValue: Record<string, string | number>
  optionsFor: (param: ReportParam) => SelectOption[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string | number>): void
  (e: 'generate'): void
}>()

function coerce(param: ReportParam, value: string): string | number {
  if (param.type !== 'number') return value
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

function update(name: string, value: string | number) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}
</script>

<style scoped lang="scss">
.filter-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.generate-btn {
  background: #0f766e !important;
  color: #fff !important;
  text-transform: none !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  height: 40px !important;
  padding: 0 20px !important;
}
</style>
