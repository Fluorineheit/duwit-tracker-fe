<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isAxiosError } from 'axios'
import Button from 'primevue/button'
import Chart from 'primevue/chart'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'

import { getExpenses } from '@/api/expenses'
import { getCategoryReport, getDailyReport } from '@/api/reports'
import type { CategoryReportItem, DailyReportItem, Expense } from '@/api/types'
import { formatDate, formatIDR, monthStartISO, todayISO } from '@/utils/format'
import { sourceBadge } from '@/utils/expenseSource'

const PALETTE = [
  '#116466',
  '#2dd4bf',
  '#f59e0b',
  '#6366f1',
  '#ef4444',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#0ea5e9',
  '#84cc16',
]

const isLoading = ref(false)
const errorMessage = ref('')

const monthTotal = ref(0)
const todayTotal = ref(0)
const monthCountLabel = ref('0')
const recentExpenses = ref<Expense[]>([])
const dailyReport = ref<DailyReportItem[]>([])
const categoryReport = ref<CategoryReportItem[]>([])

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

const categoryChartData = computed(() => ({
  labels: categoryReport.value.map((item) => item.category_name ?? 'Uncategorized'),
  datasets: [
    {
      data: categoryReport.value.map((item) => item.total),
      backgroundColor: categoryReport.value.map((_, index) => PALETTE[index % PALETTE.length]),
      borderWidth: 0,
    },
  ],
}))

const dailyChartData = computed(() => ({
  labels: dailyReport.value.map((item) => formatDate(item.date)),
  datasets: [
    {
      label: 'Daily spending',
      data: dailyReport.value.map((item) => item.total),
      backgroundColor: '#116466',
      borderRadius: 6,
    },
  ],
}))

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
    tooltip: {
      callbacks: {
        label: (ctx: { label?: string; parsed: number }) =>
          `${ctx.label ?? ''}: ${formatIDR(ctx.parsed)}`,
      },
    },
  },
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number } }) => formatIDR(ctx.parsed.y),
      },
    },
  },
  scales: {
    y: {
      ticks: {
        callback: (value: number | string) => formatIDR(Number(value)),
      },
    },
  },
}

const hasCategoryData = computed(() => categoryReport.value.length > 0)
const hasDailyData = computed(() => dailyReport.value.length > 0)

async function loadDashboard() {
  isLoading.value = true
  errorMessage.value = ''

  const from = monthStartISO()
  const to = todayISO()

  try {
    const [daily, categories, monthList, recent] = await Promise.all([
      getDailyReport({ date_from: from, date_to: to }),
      getCategoryReport({ date_from: from, date_to: to }),
      getExpenses({ from, to, limit: 10 }),
      getExpenses({ limit: 5 }),
    ])

    dailyReport.value = daily
    categoryReport.value = categories
    recentExpenses.value = recent.items

    monthTotal.value = daily.reduce((sum, item) => sum + Number(item.total), 0)
    todayTotal.value = Number(daily.find((item) => item.date === to)?.total ?? 0)
    monthCountLabel.value = `${monthList.items.length}${monthList.has_more ? '+' : ''}`
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Failed to load dashboard.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadDashboard()
})
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="page-kicker">Dashboard</p>
        <h1 class="page-title">Overview</h1>
        <p class="page-subtitle">A snapshot of this month's spending in Rupiah.</p>
      </div>

      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        :loading="isLoading"
        @click="loadDashboard"
      />
    </header>

    <Message v-if="errorMessage" severity="error" class="state-message" :closable="false">
      <div class="error-inline">
        <span>{{ errorMessage }}</span>
        <Button
          label="Retry"
          icon="pi pi-refresh"
          size="small"
          severity="danger"
          @click="loadDashboard"
        />
      </div>
    </Message>

    <div v-if="isLoading" class="dashboard-loading">
      <ProgressSpinner style="width: 48px; height: 48px" stroke-width="4" />
    </div>

    <template v-else>
      <div class="stat-grid">
        <article class="stat-card">
          <p class="stat-label">This month</p>
          <p class="stat-value">{{ formatIDR(monthTotal) }}</p>
        </article>
        <article class="stat-card">
          <p class="stat-label">Today</p>
          <p class="stat-value">{{ formatIDR(todayTotal) }}</p>
        </article>
        <article class="stat-card">
          <p class="stat-label">Expenses this month</p>
          <p class="stat-value">{{ monthCountLabel }}</p>
        </article>
      </div>

      <div class="chart-grid">
        <section class="content-panel">
          <div class="panel-toolbar">
            <h2 class="panel-title">Spending by category</h2>
          </div>
          <div class="chart-body">
            <Chart
              v-if="hasCategoryData"
              type="doughnut"
              :data="categoryChartData"
              :options="doughnutOptions"
              class="chart-canvas"
            />
            <div v-else class="table-empty">No spending this month.</div>
          </div>
        </section>

        <section class="content-panel">
          <div class="panel-toolbar">
            <h2 class="panel-title">Daily spending trend</h2>
          </div>
          <div class="chart-body">
            <Chart
              v-if="hasDailyData"
              type="bar"
              :data="dailyChartData"
              :options="barOptions"
              class="chart-canvas"
            />
            <div v-else class="table-empty">No spending this month.</div>
          </div>
        </section>
      </div>

      <section class="content-panel">
        <div class="panel-toolbar">
          <h2 class="panel-title">Recent expenses</h2>
        </div>
        <DataTable :value="recentExpenses" data-key="id" responsive-layout="scroll">
          <Column field="spent_at" header="Spent Date">
            <template #body="{ data }">
              <span>{{ formatDate(data.spent_at) }}</span>
            </template>
          </Column>
          <Column field="note" header="Note">
            <template #body="{ data }">
              <span :class="{ 'muted-cell': !data.note }">{{ data.note ?? 'No note' }}</span>
            </template>
          </Column>
          <Column field="category_name" header="Category">
            <template #body="{ data }">
              <span>{{ data.category_name ?? 'Uncategorized' }}</span>
            </template>
          </Column>
          <Column field="source" header="Source">
            <template #body="{ data }">
              <Tag
                :value="sourceBadge(data.source).label"
                :severity="sourceBadge(data.source).severity"
              />
            </template>
          </Column>
          <Column field="amount" header="Amount">
            <template #body="{ data }">
              <span class="amount-cell">{{ formatIDR(data.amount) }}</span>
            </template>
          </Column>
          <template #empty>
            <div class="table-empty">No expenses yet.</div>
          </template>
        </DataTable>
      </section>
    </template>
  </section>
</template>

<style scoped>
.dashboard-loading {
  display: flex;
  justify-content: center;
  padding: 64px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.stat-card {
  padding: 20px;
  border: 1px solid #dfe7e4;
  border-radius: 8px;
  background: #ffffff;
}

.stat-label {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 700;
  text-transform: uppercase;
}

.stat-value {
  margin: 0;
  color: #0f5f60;
  font-size: 1.6rem;
  font-weight: 800;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.chart-body {
  padding: 18px 20px;
}

.chart-canvas {
  height: 280px;
}

@media (max-width: 820px) {
  .stat-grid,
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
