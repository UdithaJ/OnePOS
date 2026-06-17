<template>
  <v-app>
    <v-app-bar app style="background: #292929;">
      <v-app-bar-title style="color: #ffffff; font-weight: 600;">Softwash</v-app-bar-title>
      <v-spacer />
      <v-menu location="bottom end" :offset="8">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" variant="text" class="user-menu-btn" rounded="pill">
            <v-avatar size="32" color="#0f766e" class="mr-2">
              <span class="text-white text-sm font-semibold">{{ userInitials }}</span>
            </v-avatar>
            <span class="user-name">{{ userName }}</span>
            <v-icon size="18" class="ml-1">mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-list rounded="lg" elevation="3" density="compact" class="pa-0">
          <v-list-item title="Logout" @click="handleLogout" class="text-center px-6 py-1" style="min-height: unset;" />
        </v-list>
      </v-menu>
    </v-app-bar>
    <v-navigation-drawer
      app
      v-model="drawer"
      :permanent="true"
      :width="260"
      class="neomorphic-sidebar"
    >
      <div class="sidebar-content">
        <v-list nav>
          <template v-for="item in menuItems" :key="item.title">
            <v-list-group v-if="item.children" :value="item.title">
              <template #activator="{ props: groupProps }">
                <v-list-item
                  v-bind="groupProps"
                  :prepend-icon="item.icon"
                  :title="item.title"
                  class="neomorphic-sidebar-item"
                />
              </template>
              <v-list-item
                v-for="child in item.children"
                :key="child.title"
                :to="child.to"
                :prepend-icon="child.icon"
                :active="isActive(child.to)"
                class="neomorphic-sidebar-item neomorphic-sidebar-child"
              >
                <v-list-item-title>{{ child.title }}</v-list-item-title>
              </v-list-item>
            </v-list-group>

            <v-list-item
              v-else
              :to="item.to"
              :prepend-icon="item.icon"
              :active="isActive(item.to)"
              class="neomorphic-sidebar-item"
            >
              <v-list-item-title>{{ item.title }}</v-list-item-title>
            </v-list-item>
          </template>
        </v-list>

        <v-list nav class="sidebar-bottom">
          <v-list-item
            to="/system-settings"
            prepend-icon="mdi-cog"
            :active="isActive('/system-settings')"
            class="neomorphic-sidebar-item"
          >
            <v-list-item-title>Settings</v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
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
const { logout, getUser } = useAuth()

const userName = computed(() => {
  const user = getUser()
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User'
})

const userInitials = computed(() => {
  const user = getUser()
  const first = user?.firstName?.[0] ?? ''
  const last = user?.lastName?.[0] ?? ''
  return (first + last).toUpperCase() || 'U'
})


onMounted(() => {
  document.body.classList.remove('dark-theme')
  document.body.classList.add('light-theme')
})

interface MenuItem {
  title: string
  to?: string
  icon: string
  disabled?: boolean
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  { title: 'Dashboard', to: '/', icon: 'mdi-view-dashboard' },
  { title: 'Orders', to: '/order-list', icon: 'mdi-clipboard-list' },
  { title: 'Customers', to: '/customers', icon: 'mdi-account-group' },
  {
    title: 'Administration',
    icon: 'mdi-shield-account-outline',
    children: [
      { title: 'Users', to: '/users', icon: 'mdi-account-cog' },
    ],
  },
  {
    title: 'Configuration',
    icon: 'mdi-cog-outline',
    children: [
      { title: 'Laundry Categories', to: '/categories', icon: 'mdi-tag-multiple' },
      { title: 'Cashflow Categories', to: '/expense-categories', icon: 'mdi-cash-sync' },
    ],
  },
  {
    title: 'Reports',
    icon: 'mdi-chart-bar',
    children: [
      { title: 'Daily Sales', to: '/reports/daily-sales', icon: 'mdi-chart-timeline-variant' },
      { title: 'Pending Orders', to: '/reports/pending-orders', icon: 'mdi-clock-alert-outline' },
      { title: 'Bank Reconciliation', to: '/reports/bank-reconciliation', icon: 'mdi-bank-transfer' },
      { title: 'Expenses', to: '/reports/expenses', icon: 'mdi-cash-minus' },
      { title: 'Returning Customers', to: '/reports/returning-customers', icon: 'mdi-account-reactivate' },
      { title: 'Cash Box Summary', to: '/reports/cash-box-summary', icon: 'mdi-cash-register' },
    ],
  },
]

function isActive(to?: string) {
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
  min-width: 260px;
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

:deep(.neomorphic-sidebar-item .v-list-item__prepend) {
  margin-inline-end: 4px !important;
  width: auto !important;
}

:deep(.v-list-group__items .neomorphic-sidebar-child) {
  padding-inline-start: 24px !important;
}

:deep(.neomorphic-sidebar-child .v-list-item__prepend) {
  margin-inline-end: 2px !important;
  width: auto !important;
}

:deep(.neomorphic-sidebar-child .v-list-item-title) {
  font-size: 0.85rem !important;
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

.user-menu-btn {
  color: #ffffff !important;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}
.user-name {
  font-size: 0.875rem;
  white-space: nowrap;
}

.neomorphic-main-bg {
  background: var(--neomorphic-container-bg) !important;
  min-height: 100vh;
  width: 100vw;
  transition: background 0.3s;
  position: relative;
  z-index: 1;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-bottom {
  margin-top: auto;
  border-top: 1px solid #e5e7eb;
  padding-top: 4px;
}
</style>
