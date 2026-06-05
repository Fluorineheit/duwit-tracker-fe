import { apiClient, unwrapApiData } from './client'
import type {
  ApiResponse,
  CategoryReportItem,
  DailyReportItem,
  MonthlyReportItem,
} from './types'

export interface DateRangeParams {
  date_from: string
  date_to: string
}

export async function getDailyReport(params: DateRangeParams) {
  const response = await apiClient.get<ApiResponse<DailyReportItem[]> | DailyReportItem[]>(
    '/reports/daily',
    { params },
  )
  return unwrapApiData<DailyReportItem[]>(response.data) ?? []
}

export async function getMonthlyReport(params: { year: string }) {
  const response = await apiClient.get<ApiResponse<MonthlyReportItem[]> | MonthlyReportItem[]>(
    '/reports/monthly',
    { params },
  )
  return unwrapApiData<MonthlyReportItem[]>(response.data) ?? []
}

export async function getCategoryReport(params: DateRangeParams) {
  const response = await apiClient.get<ApiResponse<CategoryReportItem[]> | CategoryReportItem[]>(
    '/reports/category',
    { params },
  )
  return unwrapApiData<CategoryReportItem[]>(response.data) ?? []
}
