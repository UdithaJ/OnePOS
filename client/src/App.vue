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
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
  // No direct import needed; routed components are loaded by vue-router
</script>
