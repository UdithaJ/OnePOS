<template>
  <v-card :class="['base-list-card', theme === 'teal' ? 'base-list-card--teal' : '']">
    <v-card-title class="d-flex justify-space-between align-center">
      <span>{{ title }}</span>
      <v-btn color="primary" icon="mdi-plus" @click="$emit('add')" size="small" class="ml-2" title="Add">
        <v-icon>mdi-plus</v-icon>
      </v-btn>
    </v-card-title>
    <!-- Server-side pagination -->
    <v-data-table-server
      v-if="server"
      :headers="headers || []"
      :items="items || []"
      :items-length="itemsLength || 0"
      :loading="loading"
      :page="page"
      :items-per-page="itemsPerPage"
      :items-per-page-options="[10, 25, 50, 100]"
      class="elevation-1"
      @update:options="$emit('update:options', $event)"
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
    </v-data-table-server>

    <!-- Client-side (default) -->
    <v-data-table
      v-else
      :headers="headers || []"
      :items="items || []"
      :items-per-page-options="[10, 25, 50, 100]"
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
interface Header {
  title: string
  key: string
  align?: 'start' | 'end' | 'center'
  sortable?: boolean
}

const props = defineProps<{
  title?: string
  headers: Header[]
  items: any[]
  theme?: 'dark' | 'teal'
  // Server-side pagination mode
  server?: boolean
  itemsLength?: number
  loading?: boolean
  page?: number
  itemsPerPage?: number
}>()

const emit = defineEmits(['add', 'sort', 'edit', 'update:options'])

import '../styles/BaseList.scss'
</script>
