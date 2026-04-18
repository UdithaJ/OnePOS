<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <span>{{ title }}</span>
      <v-btn color="primary" @click="$emit('add')">Add New</v-btn>
    </v-card-title>
    <v-data-table
      :headers="headers || []"
      :items="items || []"
      v-model:sort-by="sortBy"
      v-model:sort-desc="sortDesc"
      class="elevation-1"
    >
      <template #item.actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" @click="$emit('edit', item)"></v-btn>
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
</script>
