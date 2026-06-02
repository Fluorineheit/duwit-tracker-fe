import { apiClient } from './client'
import type {
  ApiResponse,
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from './types'

export async function getCategories(params: { type?: 'expense' | 'income' } = {}) {
  const response = await apiClient.get<ApiResponse<Category[]>>('/categories', {
    params,
  })

  return response.data.data
}

export async function createCategory(payload: CreateCategoryPayload) {
  const response = await apiClient.post<ApiResponse<Category>>('/categories', payload)
  return response.data.data
}

export async function updateCategory(id: string, payload: UpdateCategoryPayload) {
  const response = await apiClient.put<ApiResponse<Category>>(`/categories/${id}`, payload)
  return response.data.data
}

export async function deleteCategory(id: string) {
  const response = await apiClient.delete<ApiResponse<null>>(`/categories/${id}`)
  return response.data
}