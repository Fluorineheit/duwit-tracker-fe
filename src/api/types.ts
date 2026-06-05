export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  type: 'expense' | 'income'
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  user_id: string
  category_id: string | null
  category_name: string | null
  amount: number
  currency: string
  note: string | null
  raw_text: string | null
  source: 'manual' | 'telegram' | 'import' | 'ai'
  spent_at: string
  ai_confidence: number | null
  created_at: string
  updated_at: string
}

export interface ListExpensesResult {
  items: Expense[]
  next_cursor: string | null
  has_more: boolean
  limit: number
}

export interface ListCategoriesResult {
  items: Category[]
  next_cursor: string | null
  has_more: boolean
  limit: number
}

export interface DailyReportItem {
  date: string
  total: number
}

export interface MonthlyReportItem {
  month: string
  total: number
}

export interface CategoryReportItem {
  category_id: string | null
  category_name: string | null
  total: number
}

export interface CreateExpensePayload {
  category_id?: string
  amount: number
  currency?: string
  note?: string
  raw_text?: string
  source?: 'manual' | 'telegram' | 'import' | 'ai'
  spent_at?: string
}

export interface UpdateExpensePayload {
  category_id?: string | null
  amount?: number
  currency?: string
  note?: string | null
  raw_text?: string | null
  source?: 'manual' | 'telegram' | 'import' | 'ai'
  spent_at?: string
}

export interface CreateCategoryPayload {
  name: string
  icon?: string
  color?: string
  type?: 'expense' | 'income'
}

export interface UpdateCategoryPayload {
  name?: string
  icon?: string | null
  color?: string | null
  type?: 'expense' | 'income'
}