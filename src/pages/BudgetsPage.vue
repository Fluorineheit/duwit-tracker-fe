<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { isAxiosError } from 'axios'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import Tooltip from 'primevue/tooltip'

import { getCategories } from '@/api/categories'
import { createBudget, deleteBudget, getBudgets } from '@/api/budgets'
import { getCategoryReport } from '@/api/reports'
import type { Budget, Category, CategoryReportItem, CreateBudgetPayload } from '@/api/types'
import { firstOfMonthParam, formatIDR, formatMonth, monthRange } from '@/utils/format'

interface BudgetForm {
  categoryId: string | null
  amount: number | null
  month: Date
}

interface BudgetRow {
  budget: Budget
  categoryName: string
  spent: number
  limit: number
  percent: number
  percentLabel: string
  isOver: boolean
  overBy: number
}

const vTooltip = Tooltip

const selectedMonth = ref<Date>(new Date())
const budgets = ref<Budget[]>([])
const categoryReport = ref<CategoryReportItem[]>([])
const categories = ref<Category[]>([])

const isLoading = ref(false)
const errorMessage = ref('')

const isDialogVisible = ref(false)
const isSaving = ref(false)
const formError = ref('')
const form = reactive<BudgetForm>({
  categoryId: null,
  amount: null,
  month: new Date(),
})

const isDeleteDialogVisible = ref(false)
const budgetToDelete = ref<Budget | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

const categoryOptions = computed(() =>
  categories.value.map((category) => ({ label: category.name, value: category.id })),
)

const spentByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const item of categoryReport.value) {
    if (item.category_id) {
      map.set(item.category_id, Number(item.total))
    }
  }
  return map
})

const budgetRows = computed<BudgetRow[]>(() =>
  budgets.value.map((budget) => {
    const limit = Number(budget.amount)
    const spent = budget.category_id ? (spentByCategory.value.get(budget.category_id) ?? 0) : 0
    const ratio = limit > 0 ? spent / limit : 0

    return {
      budget,
      categoryName: budget.category_name ?? 'Uncategorized',
      spent,
      limit,
      percent: Math.min(100, Math.round(ratio * 100)),
      percentLabel: `${Math.round(ratio * 100)}%`,
      isOver: spent > limit,
      overBy: Math.max(0, spent - limit),
    }
  }),
)

const totalBudgeted = computed(() => budgetRows.value.reduce((sum, row) => sum + row.limit, 0))
const totalSpent = computed(() => budgetRows.value.reduce((sum, row) => sum + row.spent, 0))
const monthLabel = computed(() => formatMonth(firstOfMonthParam(selectedMonth.value)))

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

async function loadCategories() {
  try {
    categories.value = await getCategories({ type: 'expense' })
  } catch {
    // Non-fatal: the Add dialog will simply have no options until categories load.
  }
}

async function loadBudgets() {
  isLoading.value = true
  errorMessage.value = ''

  const { start, end } = monthRange(selectedMonth.value)

  try {
    const [budgetList, report] = await Promise.all([
      getBudgets({ month: firstOfMonthParam(selectedMonth.value) }),
      getCategoryReport({ date_from: start, date_to: end }),
    ])

    budgets.value = budgetList
    categoryReport.value = report
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Failed to load budgets.')
  } finally {
    isLoading.value = false
  }
}

function openCreateDialog() {
  form.categoryId = categoryOptions.value[0]?.value ?? null
  form.amount = null
  form.month = new Date(selectedMonth.value)
  formError.value = ''
  isDialogVisible.value = true
}

function closeCreateDialog() {
  isDialogVisible.value = false
  formError.value = ''
}

const isFormInvalid = computed(
  () => isSaving.value || !form.categoryId || !form.amount || form.amount <= 0,
)

async function handleCreateBudget() {
  formError.value = ''

  if (isFormInvalid.value || !form.categoryId || !form.amount) {
    formError.value = 'Choose a category and enter an amount.'
    return
  }

  const payload: CreateBudgetPayload = {
    category_id: form.categoryId,
    amount: form.amount,
    currency: 'IDR',
    month: firstOfMonthParam(form.month),
  }

  isSaving.value = true

  try {
    await createBudget(payload)
    isDialogVisible.value = false
    // Jump to the month we just budgeted so the new row is visible.
    selectedMonth.value = new Date(form.month)
    await loadBudgets()
  } catch (error) {
    formError.value = getErrorMessage(error, 'Failed to save budget.')
  } finally {
    isSaving.value = false
  }
}

function openDeleteDialog(budget: Budget) {
  budgetToDelete.value = budget
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

function closeDeleteDialog() {
  isDeleteDialogVisible.value = false
  deleteError.value = ''
  budgetToDelete.value = null
}

async function handleDeleteBudget() {
  if (!budgetToDelete.value) {
    return
  }

  isDeleting.value = true
  deleteError.value = ''

  try {
    await deleteBudget(budgetToDelete.value.id)
    closeDeleteDialog()
    await loadBudgets()
  } catch (error) {
    deleteError.value = getErrorMessage(error, 'Failed to delete budget.')
  } finally {
    isDeleting.value = false
  }
}

watch(selectedMonth, () => {
  void loadBudgets()
})

onMounted(() => {
  void loadCategories()
  void loadBudgets()
})
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="page-kicker">Budgets</p>
        <h1 class="page-title">Monthly budgets</h1>
        <p class="page-subtitle">Set a spending limit per category and track usage in Rupiah.</p>
      </div>

      <Button
        label="Add Budget"
        icon="pi pi-plus"
        severity="primary"
        :disabled="isLoading"
        @click="openCreateDialog"
      />
    </header>

    <Message v-if="errorMessage" severity="error" class="state-message" :closable="false">
      <div class="error-inline">
        <span>{{ errorMessage }}</span>
        <Button label="Retry" icon="pi pi-refresh" size="small" severity="danger" @click="loadBudgets" />
      </div>
    </Message>

    <section class="content-panel" aria-labelledby="budgets-table-title">
      <div class="panel-toolbar">
        <div>
          <h2 id="budgets-table-title" class="panel-title">Budgets for {{ monthLabel }}</h2>
          <p class="panel-meta">
            {{ budgetRows.length }} budgets - {{ formatIDR(totalSpent) }} spent of
            {{ formatIDR(totalBudgeted) }}
          </p>
        </div>

        <DatePicker
          v-model="selectedMonth"
          view="month"
          date-format="MM yy"
          show-icon
          :manual-input="false"
          class="filter-control"
        />
      </div>

      <div v-if="isLoading" class="budgets-loading">
        <ProgressSpinner style="width: 40px; height: 40px" stroke-width="4" />
      </div>

      <DataTable v-else :value="budgetRows" data-key="budget.id" responsive-layout="scroll">
        <Column header="Category">
          <template #body="{ data }">
            <div class="category-name-cell">
              <span
                class="category-color-dot"
                :style="{ backgroundColor: data.budget.category_name ? '#116466' : '#d7dde5' }"
                aria-hidden="true"
              ></span>
              <span>{{ data.categoryName }}</span>
            </div>
          </template>
        </Column>
        <Column header="Usage">
          <template #body="{ data }">
            <div class="usage-cell" :class="{ 'is-over': data.isOver }">
              <ProgressBar :value="data.percent" :show-value="false" />
              <span class="usage-text">
                {{ formatIDR(data.spent) }} / {{ formatIDR(data.limit) }} ({{ data.percentLabel }})
              </span>
            </div>
          </template>
        </Column>
        <Column header="Status">
          <template #body="{ data }">
            <Tag
              v-if="data.isOver"
              severity="danger"
              :value="`Over by ${formatIDR(data.overBy)}`"
            />
            <Tag v-else severity="success" value="On track" />
          </template>
        </Column>
        <Column header="Actions" frozen align-frozen="right">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                aria-label="Delete budget"
                v-tooltip.top="'Delete budget'"
                @click="openDeleteDialog(data.budget)"
              />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="table-empty">No budgets for {{ monthLabel }}. Add one to start tracking.</div>
        </template>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="isDialogVisible"
      modal
      dismissable-mask
      header="Add Budget"
      :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    >
      <form class="dialog-form" @submit.prevent="handleCreateBudget">
        <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>

        <div class="field">
          <label for="budget-category">Category</label>
          <Dropdown
            id="budget-category"
            v-model="form.categoryId"
            class="w-full"
            :options="categoryOptions"
            option-label="label"
            option-value="value"
            placeholder="Select category"
            :disabled="isSaving || categoryOptions.length === 0"
          />
          <small v-if="categoryOptions.length === 0" class="field-help">
            Add an expense category before creating budgets.
          </small>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="budget-amount">Monthly limit</label>
            <InputNumber
              id="budget-amount"
              v-model="form.amount"
              class="w-full"
              input-class="w-full"
              mode="currency"
              currency="IDR"
              locale="id-ID"
              :min="0"
              :max-fraction-digits="0"
              :disabled="isSaving"
            />
          </div>

          <div class="field">
            <label for="budget-month">Month</label>
            <DatePicker
              id="budget-month"
              v-model="form.month"
              class="w-full"
              input-class="w-full"
              view="month"
              date-format="MM yy"
              show-icon
              :manual-input="false"
              :disabled="isSaving"
            />
          </div>
        </div>

        <div class="form-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            :disabled="isSaving"
            @click="closeCreateDialog"
          />
          <Button
            type="submit"
            label="Create"
            icon="pi pi-check"
            :loading="isSaving"
            :disabled="isFormInvalid"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="isDeleteDialogVisible"
      modal
      dismissable-mask
      header="Delete Budget"
      :style="{ width: 'min(460px, calc(100vw - 32px))' }"
    >
      <div class="dialog-form">
        <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>

        <p class="confirm-copy">
          Delete the budget for <strong>{{ budgetToDelete?.category_name ?? 'this category' }}</strong>?
          This action cannot be undone.
        </p>

        <div class="form-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            :disabled="isDeleting"
            @click="closeDeleteDialog"
          />
          <Button
            type="button"
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            :loading="isDeleting"
            @click="handleDeleteBudget"
          />
        </div>
      </div>
    </Dialog>
  </section>
</template>

<style scoped>
.budgets-loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.usage-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}

.usage-cell :deep(.p-progressbar) {
  height: 10px;
}

.usage-cell.is-over :deep(.p-progressbar-value) {
  background: #ef4444;
}

.usage-text {
  font-size: 0.82rem;
  color: #64748b;
}

.usage-cell.is-over .usage-text {
  color: #ef4444;
  font-weight: 600;
}
</style>
