import { apiClient, unwrapApiData } from './client'
import type { ApiResponse, Budget, CreateBudgetPayload } from './types'

type BudgetsPayload = Budget[] | { items?: Budget[]; budgets?: Budget[] }

function normalizeBudgets(payload: BudgetsPayload): Budget[] {
  if (Array.isArray(payload)) {
    return payload
  }

  return payload.items ?? payload.budgets ?? []
}

export async function getBudgets(params: { month?: string } = {}): Promise<Budget[]> {
  const response = await apiClient.get<ApiResponse<BudgetsPayload> | BudgetsPayload>('/budgets', {
    params,
  })

  return normalizeBudgets(unwrapApiData<BudgetsPayload>(response.data))
}

export async function createBudget(payload: CreateBudgetPayload) {
  const response = await apiClient.post<ApiResponse<Budget> | Budget>('/budgets', payload)
  return unwrapApiData<Budget>(response.data)
}

export async function deleteBudget(id: string) {
  const response = await apiClient.delete<ApiResponse<null>>(`/budgets/${id}`)
  return response.data
}
