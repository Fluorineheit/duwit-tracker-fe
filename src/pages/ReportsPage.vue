<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { isAxiosError } from 'axios'
import Button from 'primevue/button'
import Chart from 'primevue/chart'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

import { getCategoryReport, getDailyReport, getMonthlyReport } from '@/api/reports'
import type { CategoryReportItem, DailyReportItem, MonthlyReportItem } from '@/api/types'
import { formatDate, formatIDR, monthStartISO, todayISO, toDateParam } from '@/utils/format'

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

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

// Date range drives the daily + category charts; year drives the monthly chart.
const dateRange = ref<Array<Date | null>>([
  new Date(monthStartISO()),
  new Date(todayISO()),
])
const selectedYear = ref<Date>(new Date())

const dailyReport = ref<DailyReportItem[]>([])
const monthlyReport = ref<MonthlyReportItem[]>([])
const categoryReport = ref<CategoryReportItem[]>([])

const isLoading = ref(false)
const errorMessage = ref('')

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

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

const monthlyChartData = computed(() => ({
  labels: monthlyReport.value.map((item) => {
    const monthIndex = Number(item.month.slice(5, 7)) - 1
    return MONTH_LABELS[monthIndex] ?? item.month
  }),
  datasets: [
    {
      label: 'Monthly spending',
      data: monthlyReport.value.map((item) => item.total),
      borderColor: '#116466',
      backgroundColor: 'rgba(17, 100, 102, 0.15)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
    },
  ],
}))

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

const lineOptions = {
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

const hasDailyData = computed(() => dailyReport.value.length > 0)
const hasMonthlyData = computed(() => monthlyReport.value.length > 0)
const hasCategoryData = computed(() => categoryReport.value.length > 0)

async function loadReports() {
  const from = dateRange.value[0]
  const to = dateRange.value[1]

  // Wait for a complete range before fetching the range-based charts.
  if (!from || !to) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  const dateFrom = toDateParam(from)
  const dateTo = toDateParam(to)
  const year = String(selectedYear.value.getFullYear())

  try {
    const [daily, monthly, category] = await Promise.all([
      getDailyReport({ date_from: dateFrom, date_to: dateTo }),
      getMonthlyReport({ year }),
      getCategoryReport({ date_from: dateFrom, date_to: dateTo }),
    ])

    dailyReport.value = daily
    monthlyReport.value = monthly
    categoryReport.value = category
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Failed to load reports.')
  } finally {
    isLoading.value = false
  }
}

watch([dateRange, selectedYear], () => {
  void loadReports()
})

onMounted(() => {
  void loadReports()
})
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="page-kicker">Reports</p>
        <h1 class="page-title">Spending reports</h1>
        <p class="page-subtitle">Analyze spending by day, month, and category in Rupiah.</p>
      </div>

      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        :loading="isLoading"
        @click="loadReports"
      />
    </header>

    <section class="content-panel filters-panel">
      <div class="filters-row">
        <div class="filter-field">
          <label for="report-range">Date range</label>
          <DatePicker
            id="report-range"
            v-model="dateRange"
            selection-mode="range"
            :manual-input="false"
            show-icon
            date-format="dd M yy"
            placeholder="Select range"
            class="filter-control"
          />
        </div>

        <div class="filter-field">
          <label for="report-year">Monthly chart year</label>
          <DatePicker
            id="report-year"
            v-model="selectedYear"
            view="year"
            date-format="yy"
            show-icon
            :manual-input="false"
            class="filter-control"
          />
        </div>
      </div>
    </section>

    <Message v-if="errorMessage" severity="error" class="state-message" :closable="false">
      <div class="error-inline">
        <span>{{ errorMessage }}</span>
        <Button label="Retry" icon="pi pi-refresh" size="small" severity="danger" @click="loadReports" />
      </div>
    </Message>

    <div v-if="isLoading" class="reports-loading">
      <ProgressSpinner style="width: 48px; height: 48px" stroke-width="4" />
    </div>

    <template v-else>
      <section class="content-panel">
        <div class="panel-toolbar">
          <h2 class="panel-title">Daily spending</h2>
        </div>
        <div class="chart-body">
          <Chart
            v-if="hasDailyData"
            type="bar"
            :data="dailyChartData"
            :options="barOptions"
            class="chart-canvas"
          />
          <div v-else class="table-empty">No spending in this range.</div>
        </div>
      </section>

      <div class="chart-grid">
        <section class="content-panel">
          <div class="panel-toolbar">
            <h2 class="panel-title">Monthly spending ({{ selectedYear.getFullYear() }})</h2>
          </div>
          <div class="chart-body">
            <Chart
              v-if="hasMonthlyData"
              type="line"
              :data="monthlyChartData"
              :options="lineOptions"
              class="chart-canvas"
            />
            <div v-else class="table-empty">No spending this year.</div>
          </div>
        </section>

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
            <div v-else class="table-empty">No spending in this range.</div>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.filters-panel {
  padding: 18px 20px;
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-field label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #64748b;
}

.reports-loading {
  display: flex;
  justify-content: center;
  padding: 64px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.chart-body {
  padding: 18px 20px;
}

.chart-canvas {
  height: 300px;
}

@media (max-width: 820px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
