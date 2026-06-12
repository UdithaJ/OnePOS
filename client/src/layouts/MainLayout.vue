<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>OnePOS</v-app-bar-title>
      <v-spacer />
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
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const drawer = ref(true)
const router = useRouter()
const route = useRoute()
const { logout } = useAuth()


onMounted(() => {
  document.body.classList.remove('dark-theme')
  document.body.classList.add('light-theme')
})

const menuItems = [
  { title: 'Dashboard', to: '/', icon: 'mdi-view-dashboard', disabled: false },
  { title: 'Orders', to: '/order-list', icon: 'mdi-clipboard-list', disabled: false },
  { title: 'Customers', to: '/customers', icon: 'mdi-account-group', disabled: false },
  { title: 'Users', to: '/users', icon: 'mdi-account-cog', disabled: false },
  { title: 'Categories', to: '/categories', icon: 'mdi-tag-multiple', disabled: false },
  { title: 'Expense Categories', to: '/expense-categories', icon: 'mdi-cash-minus', disabled: false },
  { title: 'Settings', to: '/system-settings', icon: 'mdi-cog', disabled: false },
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
  background: var(--side-bar-color) !important;
  color: var(--sidebar-text);
  min-width: 220px;
  box-shadow: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: 1px solid #e5e7eb;
  transition: background 0.3s;
}

.neomorphic-sidebar .v-list-item {
  color: var(--sidebar-text) !important;
}

.neomorphic-sidebar .v-icon {
  color: var(--sidebar-icon) !important;
}

.neomorphic-sidebar-item {
  border-radius: 10px;
  margin: 2px 8px;
  transition: background 0.15s;
}
.neomorphic-sidebar-item.v-list-item--active {
  background: #0f766e !important;
  color: #fff !important;
}
.neomorphic-sidebar-item.v-list-item--active .v-icon {
  color: #fff !important;
}
.neomorphic-sidebar-item:not(.v-list-item--active):hover {
  background: #f0fdfa !important;
  color: #0f766e !important;
}

.neomorphic-main-bg {
  background: var(--neomorphic-container-bg) !important;
  min-height: 100vh;
  width: 100vw;
  transition: background 0.3s;
  position: relative;
  z-index: 1;
}
</style>
