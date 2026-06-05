import { apiClient, unwrapApiData } from './client'
import type {
  ApiResponse,
  Category,
  CreateCategoryPayload,
  ListCategoriesResult,
  UpdateCategoryPayload,
} from './types'

export interface GetCategoriesParams {
  type?: 'expense' | 'income'
  limit?: number
  cursor?: string | null
}

type CategoriesPayload =
  | Category[]
  | {
      items?: Category[]
      categories?: Category[]
      next_cursor?: string | null
      has_more?: boolean
      limit?: number
    }

function normalizeCategoriesResult(
  payload: CategoriesPayload,
  params: GetCategoriesParams,
): ListCategoriesResult {
  if (Array.isArray(payload)) {
    return { items: payload, next_cursor: null, has_more: false, limit: params.limit ?? payload.length }
  }

  const items = payload.items ?? payload.categories ?? []

  return {
    items,
    next_cursor: payload.next_cursor ?? null,
    has_more: payload.has_more ?? false,
    limit: payload.limit ?? params.limit ?? items.length,
  }
}

/** Cursor-paginated category list (used by the Categories page infinite scroll). */
export async function listCategories(
  params: GetCategoriesParams = {},
): Promise<ListCategoriesResult> {
  const response = await apiClient.get<ApiResponse<CategoriesPayload> | CategoriesPayload>(
    '/categories',
    {
      params: { limit: 10, ...params },
    },
  )

  return normalizeCategoriesResult(unwrapApiData<CategoriesPayload>(response.data), params)
}

/** Flat category list (used by dropdowns and the dashboard). */
export async function getCategories(
  params: { type?: 'expense' | 'income'; limit?: number } = {},
) {
  const result = await listCategories({ limit: 100, ...params })
  return result.items
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
