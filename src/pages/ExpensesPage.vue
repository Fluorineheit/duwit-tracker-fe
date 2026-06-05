<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { isAxiosError } from 'axios'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import { getCategories } from '@/api/categories'
import { createExpense, getExpenses } from '@/api/expenses'
import type { Category, CreateExpensePayload, Expense } from '@/api/types'
import { formatDate, formatIDR, toDateParam } from '@/utils/format'
import { sourceBadge } from '@/utils/expenseSource'

interface ExpenseForm {
  categoryId: string | null
  amount: number | null
  note: string
  spentAt: Date | null
}

const PAGE_SIZE = 10

const expenses = ref<Expense[]>([])
const categories = ref<Category[]>([])
const cursor = ref<string | null>(null)
const hasMore = ref(true)

const isLoading = ref(false)
const isLoadingMore = ref(false)
const isSaving = ref(false)
const isDialogVisible = ref(false)
const errorMessage = ref('')
const formError = ref('')

// Filters
const filterCategoryId = ref<string | null>(null)
const filterDateRange = ref<Array<Date | null> | null>(null)

const form = reactive<ExpenseForm>({
  categoryId: null,
  amount: null,
  note: '',
  spentAt: new Date(),
})

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const categoryOptions = computed(() =>
  categories.value.map((category) => ({
    label: category.name,
    value: category.id,
  })),
)

const isCreateDisabled = computed(
  () => isSaving.value || !form.categoryId || !form.amount || form.amount <= 0 || !form.spentAt,
)

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function buildListParams() {
  const params: Record<string, string | number | null> = {
    cursor: cursor.value,
    limit: PAGE_SIZE,
  }

  if (filterCategoryId.value) {
    params.category_id = filterCategoryId.value
  }

  const range = filterDateRange.value
  if (range?.[0]) {
    params.from = toDateParam(range[0])
  }
  if (range?.[1]) {
    params.to = toDateParam(range[1])
  }

  return params
}

/** Load the next page of expenses. Appends unless this is the first page. */
async function loadExpenses() {
  if (!hasMore.value || isLoadingMore.value) return

  const isFirstPage = cursor.value === null

  if (isFirstPage) {
    isLoading.value = true
    errorMessage.value = ''
  } else {
    isLoadingMore.value = true
  }

  try {
    const result = await getExpenses(buildListParams())
    expenses.value.push(...result.items)
    cursor.value = result.next_cursor
    hasMore.value = result.has_more
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Failed to load expenses.')
    hasMore.value = false
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

/** Reset pagination and reload from the first page (used on filter change/create). */
async function reloadFromStart() {
  expenses.value = []
  cursor.value = null
  hasMore.value = true
  await loadExpenses()

  // Re-kick the observer in case the fresh (short) list keeps the sentinel in view.
  if (hasMore.value && observer && sentinel.value) {
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  }
}

async function loadCategories() {
  try {
    categories.value = await getCategories({ type: 'expense' })
    if (!form.categoryId) {
      form.categoryId = categories.value[0]?.id ?? null
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Failed to load categories.')
  }
}

function resetForm() {
  form.categoryId = categories.value[0]?.id ?? null
  form.amount = null
  form.note = ''
  form.spentAt = new Date()
  formError.value = ''
}

function openCreateDialog() {
  resetForm()
  isDialogVisible.value = true
}

function closeCreateDialog() {
  isDialogVisible.value = false
  formError.value = ''
}

function toSpentAtPayload(date: Date) {
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  return localNoon.toISOString()
}

async function handleCreateExpense() {
  formError.value = ''

  if (isCreateDisabled.value || !form.categoryId || !form.amount || !form.spentAt) {
    formError.value = 'Choose a category, enter an amount, and select a spent date.'
    return
  }

  const payload: CreateExpensePayload = {
    category_id: form.categoryId,
    amount: form.amount,
    currency: 'IDR',
    source: 'manual',
    spent_at: toSpentAtPayload(form.spentAt),
  }

  const note = form.note.trim()
  if (note) {
    payload.note = note
  }

  isSaving.value = true

  try {
    await createExpense(payload)
    isDialogVisible.value = false
    resetForm()
    await reloadFromStart()
  } catch (error) {
    formError.value = getErrorMessage(error, 'Failed to create expense.')
  } finally {
    isSaving.value = false
  }
}

// Reset and reload whenever a filter changes.
watch(
  [filterCategoryId, filterDateRange],
  () => {
    void reloadFromStart()
  },
  { deep: true },
)

/**
 * Called whenever the sentinel scrolls into view. After loading a page we
 * re-observe the sentinel so the observer re-emits its current state — without
 * this, a sentinel that stays visible (list still shorter than the viewport)
 * would never fire again and pagination would stall before reaching the end.
 */
async function onSentinelVisible() {
  if (!hasMore.value || isLoadingMore.value || isLoading.value) return

  await loadExpenses()

  if (hasMore.value && observer && sentinel.value) {
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  }
}

onMounted(async () => {
  await loadCategories()
  await reloadFromStart()

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        void onSentinelVisible()
      }
    },
    // Prefetch a full viewport ahead so the next page is usually ready
    // before the user scrolls to it (no visible loading pop-in).
    { rootMargin: '100% 0px' },
  )

  if (sentinel.value) {
    observer.observe(sentinel.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="page-kicker">Expenses</p>
        <h1 class="page-title">Track daily spending</h1>
        <p class="page-subtitle">
          Record manual expenses, keep categories tidy, and review spending in Rupiah.
        </p>
      </div>

      <Button
        label="Add Expense"
        icon="pi pi-plus"
        severity="primary"
        :disabled="isLoading"
        @click="openCreateDialog"
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
          @click="reloadFromStart"
        />
      </div>
    </Message>

    <section class="content-panel" aria-labelledby="expenses-table-title">
      <div class="panel-toolbar">
        <div>
          <h2 id="expenses-table-title" class="panel-title">Expense list</h2>
          <p class="panel-meta">{{ expenses.length }} loaded</p>
        </div>

        <div class="panel-filters">
          <Dropdown
            v-model="filterCategoryId"
            :options="categoryOptions"
            option-label="label"
            option-value="value"
            placeholder="All categories"
            show-clear
            class="filter-control"
          />
          <DatePicker
            v-model="filterDateRange"
            selection-mode="range"
            :manual-input="false"
            show-icon
            show-button-bar
            date-format="dd M yy"
            placeholder="Date range"
            class="filter-control"
          />
        </div>
      </div>

      <DataTable
        :value="expenses"
        data-key="id"
        :loading="isLoading"
        striped-rows
        responsive-layout="scroll"
      >
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
            <Tag :value="sourceBadge(data.source).label" :severity="sourceBadge(data.source).severity" />
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

      <div ref="sentinel" class="scroll-sentinel">
        <ProgressSpinner v-if="isLoadingMore" style="width: 32px; height: 32px" stroke-width="4" />
        <span v-else-if="!hasMore && expenses.length" class="scroll-end">End of list</span>
      </div>
    </section>

    <Dialog
      v-model:visible="isDialogVisible"
      modal
      dismissable-mask
      header="Add Expense"
      :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    >
      <form class="dialog-form" @submit.prevent="handleCreateExpense">
        <Message v-if="formError" severity="error" :closable="false">
          {{ formError }}
        </Message>

        <div class="field">
          <label for="expense-category">Category</label>
          <Dropdown
            id="expense-category"
            v-model="form.categoryId"
            class="w-full"
            :options="categoryOptions"
            option-label="label"
            option-value="value"
            placeholder="Select category"
            :disabled="isSaving || categoryOptions.length === 0"
          />
          <small v-if="categoryOptions.length === 0" class="field-help">
            Add an expense category before creating expenses.
          </small>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="expense-amount">Amount</label>
            <InputNumber
              id="expense-amount"
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
            <label for="expense-spent-at">Spent Date</label>
            <DatePicker
              id="expense-spent-at"
              v-model="form.spentAt"
              class="w-full"
              input-class="w-full"
              show-icon
              date-format="dd M yy"
              :disabled="isSaving"
            />
          </div>
        </div>

        <div class="field">
          <label for="expense-note">Note</label>
          <Textarea
            id="expense-note"
            v-model="form.note"
            class="w-full"
            rows="4"
            auto-resize
            :disabled="isSaving"
          />
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
            :disabled="isCreateDisabled"
          />
        </div>
      </form>
    </Dialog>
  </section>
</template>

<style scoped>
.panel-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-control {
  min-width: 200px;
}

.scroll-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0.75rem;
}

.scroll-end {
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 0.85rem;
}
</style>
