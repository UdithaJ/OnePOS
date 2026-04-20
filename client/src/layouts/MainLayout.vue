<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="rail = !rail" />
      <v-toolbar-title>Main Layout</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="handleLogout">
        <v-icon>mdi-logout</v-icon>
        <v-tooltip activator="parent">Logout</v-tooltip>
      </v-btn>
    </v-app-bar>
    <v-navigation-drawer app permanent :rail="rail">
      <v-list>
        <v-list-item to="/" title="Dashboard" prepend-icon="mdi-view-dashboard" />
        <v-list-item to="/order-list" title="Orders" prepend-icon="mdi-clipboard-list" />
        <v-list-item to="/customers" title="Customers" prepend-icon="mdi-account-group" />
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
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const rail = ref(false)
const router = useRouter()
const { logout } = useAuth()

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

<style scoped>
/* Add any custom styles here */
</style>
