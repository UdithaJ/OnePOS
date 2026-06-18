import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const ADMIN_ONLY = { requiresAuth: true, roles: ['admin'] }

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
        meta: ADMIN_ONLY,
        component: () => import('@/components/Customers.vue'),
      },
      {
        path: 'users',
        name: 'Users',
        meta: ADMIN_ONLY,
        component: () => import('@/components/Users.vue'),
      },
      {
        path: 'categories',
        name: 'Categories',
        meta: ADMIN_ONLY,
        component: () => import('@/components/Categories.vue'),
      },
      {
        path: 'expense-categories',
        name: 'ExpenseCategories',
        meta: ADMIN_ONLY,
        component: () => import('@/components/ExpenseCategories.vue'),
      },
      {
        path: 'system-settings',
        name: 'SystemSettings',
        meta: ADMIN_ONLY,
        component: () => import('@/components/SystemSettings.vue'),
      },
      {
        path: 'reports/daily-sales',
        name: 'DailySalesReport',
        meta: ADMIN_ONLY,
        component: () => import('@/components/reports/DailySalesReport.vue'),
      },
      {
        path: 'reports/pending-orders',
        name: 'PendingOrdersReport',
        meta: ADMIN_ONLY,
        component: () => import('@/components/reports/PendingOrdersReport.vue'),
      },
      {
        path: 'reports/bank-reconciliation',
        name: 'BankReconciliationReport',
        meta: ADMIN_ONLY,
        component: () => import('@/components/reports/BankReconciliationReport.vue'),
      },
      {
        path: 'reports/expenses',
        name: 'ExpensesReport',
        meta: ADMIN_ONLY,
        component: () => import('@/components/reports/ExpensesReport.vue'),
      },
      {
        path: 'reports/returning-customers',
        name: 'ReturningCustomersReport',
        meta: ADMIN_ONLY,
        component: () => import('@/components/reports/ReturningCustomersReport.vue'),
      },
      {
        path: 'reports/cash-box-summary',
        name: 'CashBoxSummaryReport',
        meta: ADMIN_ONLY,
        component: () => import('@/components/reports/CashBoxSummaryReport.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const { isLoggedIn, getUser } = useAuth()

  if (to.meta.requiresAuth && !isLoggedIn()) {
    return { name: 'Login' }
  }

  if (to.name === 'Login' && isLoggedIn()) {
    return { name: 'Dashboard' }
  }

  const roles = to.meta.roles as string[] | undefined
  if (roles) {
    const user = getUser()
    if (!user || !roles.includes(user.userRole)) {
      return { name: 'Dashboard' }
    }
  }
})

export default router
