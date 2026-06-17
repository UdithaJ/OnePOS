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
import { ref } from 'vue'

interface Header {
  title: string
  key: string
  align?: string
  sortable?: boolean
}

const props = defineProps<{
  title?: string
  headers: Header[]
  items: any[]
  theme?: 'dark' | 'teal'
}>()

const emit = defineEmits(['add', 'sort', 'edit'])

import '../styles/BaseList.scss'
</script>
