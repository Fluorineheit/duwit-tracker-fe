<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { isAxiosError } from 'axios'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'

import { getCategories } from '@/api/categories'
import { createExpense, getExpenses } from '@/api/expenses'
import type { Category, CreateExpensePayload, Expense } from '@/api/types'

interface ExpenseForm {
  categoryId: string | null
  amount: number | null
  note: string
  spentAt: Date | null
}

const expenses = ref<Expense[]>([])
const categories = ref<Category[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const isDialogVisible = ref(false)
const errorMessage = ref('')
const formError = ref('')

const form = reactive<ExpenseForm>({
  categoryId: null,
  amount: null,
  note: '',
  spentAt: new Date(),
})

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const categoryOptions = computed(() =>
  categories.value.map((category) => ({
    label: category.name,
    value: category.id,
  })),
)

const totalAmount = computed(() =>
  expenses.value.reduce((total, expense) => total + Number(expense.amount), 0),
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

function formatAmount(amount: number) {
  return rupiahFormatter.format(Number(amount))
}

function formatSpentDate(spentAt: string) {
  return dateFormatter.format(new Date(spentAt))
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

async function loadData() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [expenseResult, categoryResult] = await Promise.all([
      getExpenses({ limit: 100, offset: 0 }),
      getCategories({ type: 'expense' }),
    ])

    expenses.value = expenseResult.items
    categories.value = categoryResult

    if (!form.categoryId) {
      form.categoryId = categoryResult[0]?.id ?? null
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Failed to load expenses.')
  } finally {
    isLoading.value = false
  }
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
    await loadData()
  } catch (error) {
    formError.value = getErrorMessage(error, 'Failed to create expense.')
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void loadData()
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
        <Button label="Retry" icon="pi pi-refresh" size="small" severity="danger" @click="loadData" />
      </div>
    </Message>

    <section class="content-panel" aria-labelledby="expenses-table-title">
      <div class="panel-toolbar">
        <div>
          <h2 id="expenses-table-title" class="panel-title">Expense list</h2>
          <p class="panel-meta">
            {{ expenses.length }} records - {{ formatAmount(totalAmount) }} total
          </p>
        </div>
      </div>

      <DataTable
        :value="expenses"
        data-key="id"
        :loading="isLoading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 25, 50]"
        striped-rows
        responsive-layout="scroll"
      >
        <Column field="spent_at" header="Spent Date" sortable>
          <template #body="{ data }">
            <span>{{ formatSpentDate(data.spent_at) }}</span>
          </template>
        </Column>
        <Column field="category_name" header="Category" sortable>
          <template #body="{ data }">
            <span>{{ data.category_name ?? 'Uncategorized' }}</span>
          </template>
        </Column>
        <Column field="note" header="Note">
          <template #body="{ data }">
            <span :class="{ 'muted-cell': !data.note }">{{ data.note ?? 'No note' }}</span>
          </template>
        </Column>
        <Column field="amount" header="Amount" sortable>
          <template #body="{ data }">
            <span class="amount-cell">{{ formatAmount(data.amount) }}</span>
          </template>
        </Column>
        <template #empty>
          <div class="table-empty">No expenses yet.</div>
        </template>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="isDialogVisible"
      modal
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
