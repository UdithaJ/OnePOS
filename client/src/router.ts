import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
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

export default router
