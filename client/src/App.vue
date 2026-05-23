<template>
  <v-app>
    <v-main>
      <router-view />
      <v-btn
        class="m-2"
        icon="mdi-theme-light-dark"
        location="top right"
        position="absolute"
        @click="$vuetify.theme.cycle()"
      />
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
