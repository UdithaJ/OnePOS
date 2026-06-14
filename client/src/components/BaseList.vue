<template>
  <v-card :class="['base-list-card', theme === 'teal' ? 'base-list-card--teal' : '']">
    <v-card-title class="d-flex justify-space-between align-center">
      <span>{{ title }}</span>
      <v-btn color="primary" icon="mdi-plus" @click="$emit('add')" size="small" class="ml-2" title="Add">
        <v-icon>mdi-plus</v-icon>
      </v-btn>
    </v-card-title>
    <v-data-table
      :headers="headers || []"
      :items="items || []"
      v-model:sort-by="sortBy"
      v-model:sort-desc="sortDesc"
      class="elevation-1"
    >
      <template #item.actions="{ item }">
        <slot name="actions" :item="item">
          <v-btn icon="mdi-pencil" size="small" @click="$emit('edit', item)"></v-btn>
        </slot>
      </template>
      <template
        v-for="header in (headers || []).filter(h => h.key !== 'actions')"
        :key="header.key"
        v-slot:[`item.${header.key}`]="slotProps"
      >
        <slot :name="`item.${header.key}`" v-bind="slotProps">{{ slotProps.item[header.key] }}</slot>
      </template>
      <template v-slot:no-data>
        <v-alert type="info">No records found.</v-alert>
      </template>
    </v-data-table>
  </v-card>
</template>

<script lang="ts" setup>

import { ref, defineProps, defineEmits } from 'vue'

interface Header {
  title: string
  key: string
  align?: string
}
const props = defineProps<{
  title?: string
  headers: Header[]
  items: any[]
  theme?: 'dark' | 'teal'
}>()

const emit = defineEmits(['add', 'sort', 'edit'])

const sortBy = ref([props.headers[0]?.value ?? ''])
const sortDesc = ref(false)

function onSortBy(val: string[] | string) {
  sortBy.value = Array.isArray(val) ? val : [val]
  emit('sort', { sortBy: sortBy.value, sortDesc: sortDesc.value })
}
function onSortDesc(val: boolean) {
  sortDesc.value = val
  emit('sort', { sortBy: sortBy.value, sortDesc: val })
}
import '../styles/BaseList.scss'
</script>
