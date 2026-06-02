import { apiClient } from './client'
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

export async function getExpenses(params: GetExpensesParams = {}) {
  const response = await apiClient.get<ApiResponse<ListExpensesResult>>('/expenses', {
    params,
  })

  return response.data.data
}

export async function getExpenseById(id: string) {
  const response = await apiClient.get<ApiResponse<Expense>>(`/expenses/${id}`)
  return response.data.data
}

export async function createExpense(payload: CreateExpensePayload) {
  const response = await apiClient.post<ApiResponse<Expense>>('/expenses', payload)
  return response.data.data
}

export async function updateExpense(id: string, payload: UpdateExpensePayload) {
  const response = await apiClient.put<ApiResponse<Expense>>(`/expenses/${id}`, payload)
  return response.data.data
}

export async function deleteExpense(id: string) {
  const response = await apiClient.delete<ApiResponse<null>>(`/expenses/${id}`)
  return response.data
}