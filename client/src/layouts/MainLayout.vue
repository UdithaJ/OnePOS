<template>
  <v-app>
    <v-app-bar app class="custom-app-bar" flat>
      <v-app-bar-nav-icon @click="rail = !rail" color="#fff" />
      <v-toolbar-title class="custom-app-bar-title">Main Layout</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="handleLogout">
        <v-icon color="#fff">mdi-logout</v-icon>
        <v-tooltip activator="parent">Logout</v-tooltip>
      </v-btn>
    </v-app-bar>
    <v-navigation-drawer app permanent :rail="rail" class="custom-sidebar">
      <div class="sidebar-logo">Washly</div>
      <v-list :active-class="'sidebar-item--active'">
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          class="sidebar-item"
          :active="isActive(item.to)"
          :disabled="item.disabled"
        >
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
 </template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const rail = ref(false)
const router = useRouter()
const route = useRoute()
const { logout } = useAuth()

const menuItems = [
  { title: 'Dashboard', to: '/', icon: 'mdi-view-dashboard', disabled: false },
  { title: 'Orders', to: '/order-list', icon: 'mdi-clipboard-list', disabled: false },
  { title: 'Customers', to: '/customers', icon: 'mdi-account-group', disabled: false },
  { title: 'History', to: '', icon: 'mdi-history', disabled: true },
]

function isActive(to: string) {
  return to && route.path === to
}

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

<style scoped>
.custom-app-bar {
  background: #18142a !important;
  color: #fff !important;
  box-shadow: none !important;
}
.custom-app-bar-title {
  color: #fff !important;
}
.custom-sidebar {
  background: #20194a !important;
  color: #fff !important;
  padding-top: 32px;
  border-right: 1px solid #231e3a;
}
.sidebar-logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #b18cff;
  margin-bottom: 48px;
  text-align: center;
}
.sidebar-item {
  color: #bdbdbd !important;
  border-radius: 8px 0 0 8px;
  margin-bottom: 8px;
  background: transparent !important;
  transition: background 0.2s, color 0.2s;
}
.sidebar-item .v-list-item__content,
.sidebar-item .v-list-item-title {
  color: #bdbdbd !important;
}
.sidebar-item .v-icon {
  color: #bdbdbd !important;
}
.sidebar-item--active,
.sidebar-item--active .v-list-item__content,
.sidebar-item--active .v-list-item-title {
  background: #2d235a !important;
  color: #fff !important;
}
.sidebar-item--active .v-icon {
  color: #fff !important;
}
.sidebar-item:hover,
.sidebar-item:hover .v-list-item__content,
.sidebar-item:hover .v-list-item-title {
  background: #2d235a !important;
  color: #fff !important;
}
.sidebar-item:hover .v-icon {
  color: #fff !important;
}
</style>
