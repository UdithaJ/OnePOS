<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>OnePOS</v-app-bar-title>
      <v-spacer />
      <v-btn icon @click="toggleTheme">
        <v-icon>{{ isDarkTheme ? 'mdi-white-balance-sunny' : 'mdi-weather-night' }}</v-icon>
      </v-btn>
      <v-btn icon @click="handleLogout">
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>
    <v-navigation-drawer
      app
      v-model="drawer"
      :permanent="true"
      class="neomorphic-sidebar"
    >
      <v-list nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :active="isActive(item.to)"
          class="neomorphic-sidebar-item"
        >
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-main class="neomorphic-main-bg">
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const drawer = ref(true)
const router = useRouter()
const route = useRoute()
const { logout } = useAuth()


const isDarkTheme = computed(() => document.body.classList.contains('dark-theme'))

onMounted(() => {
  // Ensure only one theme class is present, default to light
  document.body.classList.remove('dark-theme')
  document.body.classList.add('light-theme')
})

function toggleTheme() {
  if (document.body.classList.contains('dark-theme')) {
    document.body.classList.remove('dark-theme')
    document.body.classList.add('light-theme')
  } else {
    document.body.classList.remove('light-theme')
    document.body.classList.add('dark-theme')
  }
}

const menuItems = [
  { title: 'Dashboard', to: '/', icon: 'mdi-view-dashboard', disabled: false },
  { title: 'Orders', to: '/order-list', icon: 'mdi-clipboard-list', disabled: false },
  { title: 'Customers', to: '/customers', icon: 'mdi-account-group', disabled: false },
  { title: 'Users', to: '/users', icon: 'mdi-account-cog', disabled: false },
  { title: 'Categories', to: '/categories', icon: 'mdi-tag-multiple', disabled: false },
  { title: 'Expense Categories', to: '/expense-categories', icon: 'mdi-cash-minus', disabled: false },
]

function isActive(to: string) {
  return !!to && route.path === to
}

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

<style scoped lang="scss">
@import '../styles/neomorphic.scss';


.neomorphic-sidebar {
  background: var(--side-bar-color);
  color: var(--sidebar-text);
  min-width: 220px;
  box-shadow: 8px 0 16px var(--neomorphic-shadow-dark), -8px 0 16px var(--neomorphic-shadow-light);
  border-top-right-radius: 24px;
  border-bottom-right-radius: 24px;
  transition: background 0.3s;
}

.neomorphic-sidebar .v-list-item {
  color: var(--sidebar-text);
}

.neomorphic-sidebar .v-icon {
  color: var(--sidebar-icon);
}

.neomorphic-sidebar-item {
  border-radius: 16px;
  margin: 4px 8px;
  transition: background 0.2s;
}
.neomorphic-sidebar-item.v-list-item--active {
  background: var(--neomorphic-accent);
  color: #fff;
}
.neomorphic-sidebar-item.v-list-item--active .v-icon {
  color: #fff;
}

.neomorphic-sidebar .v-list-item {
  color: var(--sidebar-text);
}

.neomorphic-sidebar .v-icon {
  color: var(--sidebar-icon);
}

.neomorphic-sidebar-item {
  border-radius: 16px;
  margin: 4px 8px;
  transition: background 0.2s;
}
.neomorphic-sidebar-item.v-list-item--active {
  background: var(--neomorphic-accent);
  color: #fff;
}
.neomorphic-sidebar-item.v-list-item--active .v-icon {
  color: #fff;
}
// ...existing code...
.neomorphic-main-bg {
  background: var(--neomorphic-container-bg) !important;
  min-height: 100vh;
  width: 100vw;
  transition: background 0.3s;
  position: relative;
  z-index: 1;
}
</style>
