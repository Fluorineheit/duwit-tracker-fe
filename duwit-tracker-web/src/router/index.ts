import { createRouter, createWebHistory } from 'vue-router'

import DashboardPage from '@/pages/DashboardPage.vue'
import ExpensesPage from '@/pages/ExpensesPage.vue'
import CategoriesPage from '@/pages/CategoriesPage.vue'
import BudgetsPage from '@/pages/BudgetsPage.vue'
import ReportsPage from '@/pages/ReportsPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardPage,
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: ExpensesPage,
    },
    {
      path: '/categories',
      name: 'categories',
      component: CategoriesPage,
    },
    {
      path: '/budgets',
      name: 'budgets',
      component: BudgetsPage,
    },
    {
      path: '/reports',
      name: 'reports',
      component: ReportsPage,
    },
  ],
})

export default router