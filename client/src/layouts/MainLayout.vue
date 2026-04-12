<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Main Layout</v-toolbar-title>
    </v-app-bar>
    <v-navigation-drawer app v-model="drawer">
      <v-list>
        <v-list-item to="/" title="Home" />
        <v-list-item to="/order-list" title="Orders" />
        <!-- Add more navigation items here -->
      </v-list>
    </v-navigation-drawer>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
const drawer = ref(false)
</script>

<style scoped>
/* Add any custom styles here */
</style>
