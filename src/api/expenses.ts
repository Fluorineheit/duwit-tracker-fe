import { apiClient, unwrapApiData } from './client'
import type {
  ApiResponse,
  CreateExpensePayload,
  Expense,
  ListExpensesResult,
  UpdateExpensePayload,
} from './types'

export interface GetExpensesParams {
  limit?: number
  offset?: number
  category_id?: string
  from?: string
  to?: string
  search?: string
}

type ExpensesPayload =
  | ListExpensesResult
  | Expense[]
  | {
      expenses?: Expense[]
      total?: number
      limit?: number
      offset?: number
    }

function normalizeExpensesResult(
  result: ExpensesPayload,
  params: GetExpensesParams,
): ListExpensesResult {
  if (Array.isArray(result)) {
    return {
      items: result,
      total: result.length,
      limit: params.limit ?? result.length,
      offset: params.offset ?? 0,
    }
  }

  if ('items' in result) {
    return result
  }

  if ('expenses' in result) {
    const items = result.expenses ?? []

    return {
      items,
      total: result.total ?? items.length,
      limit: result.limit ?? params.limit ?? items.length,
      offset: result.offset ?? params.offset ?? 0,
    }
  }

  return {
    items: [],
    total: 0,
    limit: params.limit ?? 0,
    offset: params.offset ?? 0,
  }
}

export async function getExpenses(params: GetExpensesParams = {}) {
  const response = await apiClient.get<ApiResponse<ExpensesPayload> | ExpensesPayload>(
    '/expenses',
    {
      params,
    },
  )

  const result = unwrapApiData<ExpensesPayload>(response.data)
  return normalizeExpensesResult(result, params)
}

export async function getExpenseById(id: string) {
  const response = await apiClient.get<ApiResponse<Expense> | Expense>(`/expenses/${id}`)
  return unwrapApiData<Expense>(response.data)
}

export async function createExpense(payload: CreateExpensePayload) {
  const response = await apiClient.post<ApiResponse<Expense> | Expense>('/expenses', payload)
  return unwrapApiData<Expense>(response.data)
}

export async function updateExpense(id: string, payload: UpdateExpensePayload) {
  const response = await apiClient.put<ApiResponse<Expense> | Expense>(`/expenses/${id}`, payload)
  return unwrapApiData<Expense>(response.data)
}

export async function deleteExpense(id: string) {
  const response = await apiClient.delete<ApiResponse<null>>(`/expenses/${id}`)
  return response.data
}
