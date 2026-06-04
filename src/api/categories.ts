import { apiClient, unwrapApiData } from './client'
import type {
  ApiResponse,
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from './types'

type CategoriesPayload = Category[] | { categories?: Category[] }

function normalizeCategories(payload: CategoriesPayload) {
  if (Array.isArray(payload)) {
    return payload
  }

  return payload.categories ?? []
}

export async function getCategories(params: { type?: 'expense' | 'income' } = {}) {
  const response = await apiClient.get<ApiResponse<CategoriesPayload> | CategoriesPayload>('/categories', {
    params,
  })

  return normalizeCategories(unwrapApiData<CategoriesPayload>(response.data))
}

export async function createCategory(payload: CreateCategoryPayload) {
  const response = await apiClient.post<ApiResponse<Category> | Category>('/categories', payload)
  return unwrapApiData<Category>(response.data)
}

export async function updateCategory(id: string, payload: UpdateCategoryPayload) {
  const response = await apiClient.put<ApiResponse<Category> | Category>(`/categories/${id}`, payload)
  return unwrapApiData<Category>(response.data)
}

export async function deleteCategory(id: string) {
  const response = await apiClient.delete<ApiResponse<null>>(`/categories/${id}`)
  return response.data
}
