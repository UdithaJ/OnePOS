<template>
  <v-app>
    <v-main>
      <router-view />
<div v-if="toast.show" :style="toastStyle">
        {{ toast.message }}
      </div>
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import { toast, toastStyle } from './composables/useToast'
import './styles/neomorphic.scss'
</script>
