import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/components/Login.vue'),
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/components/Dashboard.vue'),
      },
      {
        path: 'order-list',
        name: 'OrderList',
        component: () => import('@/components/OrderList.vue'),
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('@/components/Customers.vue'),
      },
      // Add more child routes here
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const { isLoggedIn } = useAuth()
  if (to.meta.requiresAuth && !isLoggedIn()) {
    return { name: 'Login' }
  }
  if (to.name === 'Login' && isLoggedIn()) {
    return { name: 'Dashboard' }
  }
})

export default router
