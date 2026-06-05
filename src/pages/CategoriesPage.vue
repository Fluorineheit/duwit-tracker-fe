<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { isAxiosError } from 'axios'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Tooltip from 'primevue/tooltip'

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/api/categories'
import type { Category, CreateCategoryPayload, UpdateCategoryPayload } from '@/api/types'

type CategoryType = Category['type']
type DialogMode = 'create' | 'edit'

interface CategoryForm {
  name: string
  type: CategoryType
  icon: string
  color: string
}

const categoryTypes: Array<{ label: string; value: CategoryType }> = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
]

const colorSwatches = [
  '#116466',
  '#2f80ed',
  '#27ae60',
  '#f2c94c',
  '#eb5757',
  '#9b51e0',
  '#f2994a',
  '#64748b',
]

// Curated emoji palette for category icons (each is at most 2 code points).
const categoryEmojis = [
  '🛒', '🍔', '☕', '🍽️', '🍺', '🛍️',
  '🏠', '💡', '🧾', '💳', '💰', '📱',
  '🚗', '⛽', '🚌', '✈️', '🏥', '💊',
  '🏋️', '🎮', '🎬', '📚', '👕', '🎁',
  '❤️', '🐱', '🎓', '💼', '✂️', '⭐',
]

const vTooltip = Tooltip

const PAGE_SIZE = 10

const categories = ref<Category[]>([])
const cursor = ref<string | null>(null)
const hasMore = ref(true)
const isLoadingMore = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const activeType = ref<CategoryType>('expense')
const dialogMode = ref<DialogMode>('create')
const selectedCategory = ref<Category | null>(null)
const categoryToDelete = ref<Category | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const isCategoryDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const errorMessage = ref('')
const formError = ref('')
const deleteError = ref('')

const form = reactive<CategoryForm>({
  name: '',
  type: 'expense',
  icon: '',
  color: colorSwatches[0] ?? '#116466',
})

const filteredCategories = computed(() =>
  categories.value.filter((category) => category.type === activeType.value),
)

const panelTitle = computed(() =>
  activeType.value === 'expense' ? 'Expense categories' : 'Income categories',
)

const dialogTitle = computed(() =>
  dialogMode.value === 'create' ? 'Add Category' : 'Edit Category',
)

const isFormInvalid = computed(() => isSaving.value || form.name.trim().length === 0)

const dateFormatter = new Intl.DateTimeFormat('id-ID')

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function resetForm(type: CategoryType = activeType.value) {
  form.name = ''
  form.type = type
  form.icon = ''
  form.color = colorSwatches[0] ?? '#116466'
  formError.value = ''
  selectedCategory.value = null
}

function openCreateDialog() {
  dialogMode.value = 'create'
  resetForm()
  isCategoryDialogVisible.value = true
}

function openEditDialog(category: Category) {
  dialogMode.value = 'edit'
  selectedCategory.value = category
  form.name = category.name
  form.type = category.type
  form.icon = category.icon ?? ''
  form.color = category.color ?? colorSwatches[0] ?? '#116466'
  formError.value = ''
  isCategoryDialogVisible.value = true
}

function closeCategoryDialog() {
  isCategoryDialogVisible.value = false
  formError.value = ''
}

function openDeleteDialog(category: Category) {
  if (category.is_default) {
    return
  }

  categoryToDelete.value = category
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

function closeDeleteDialog() {
  isDeleteDialogVisible.value = false
  deleteError.value = ''
  categoryToDelete.value = null
}

function chooseSwatch(color: string) {
  form.color = color
}

function chooseEmoji(emoji: string) {
  // Toggle off if the same emoji is tapped again.
  form.icon = form.icon === emoji ? '' : emoji
}

function formatUpdatedDate(updatedAt: string) {
  return dateFormatter.format(new Date(updatedAt))
}

function isPrimeIcon(icon: string | null) {
  return icon?.startsWith('pi ') ?? false
}

/** Treat short, non-prefixed strings as emoji; legacy icon names are longer. */
function isEmojiIcon(icon: string | null) {
  return !!icon && !isPrimeIcon(icon) && [...icon].length <= 2
}

function buildPayload(): CreateCategoryPayload | UpdateCategoryPayload {
  const payload: CreateCategoryPayload = {
    name: form.name.trim(),
    type: form.type,
  }

  const icon = form.icon.trim()
  const color = form.color.trim()

  if (icon) {
    payload.icon = icon
  }

  if (color) {
    payload.color = color
  }

  return payload
}

/** Load the next page of categories. Appends unless this is the first page. */
async function loadCategories() {
  if (!hasMore.value || isLoadingMore.value) return

  const isFirstPage = cursor.value === null

  if (isFirstPage) {
    isLoading.value = true
    errorMessage.value = ''
  } else {
    isLoadingMore.value = true
  }

  try {
    const result = await listCategories({ cursor: cursor.value, limit: PAGE_SIZE })
    categories.value.push(...result.items)
    cursor.value = result.next_cursor
    hasMore.value = result.has_more
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Failed to load categories.')
    hasMore.value = false
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

/** Reset pagination and reload from the first page (after create/edit/delete). */
async function reloadFromStart() {
  categories.value = []
  cursor.value = null
  hasMore.value = true
  await loadCategories()

  // Re-kick the observer in case the fresh (short) list keeps the sentinel in view.
  if (hasMore.value && observer && sentinel.value) {
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  }
}

/**
 * Called whenever the sentinel scrolls into view. Re-observing after each load
 * makes the observer re-emit, so a sentinel that stays visible keeps loading
 * until the viewport is filled or there are no more pages.
 */
async function onSentinelVisible() {
  if (!hasMore.value || isLoadingMore.value || isLoading.value) return

  await loadCategories()

  if (hasMore.value && observer && sentinel.value) {
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  }
}

async function handleSaveCategory() {
  formError.value = ''

  if (isFormInvalid.value) {
    formError.value = 'Category name is required.'
    return
  }

  isSaving.value = true

  try {
    const payload = buildPayload()

    if (dialogMode.value === 'edit' && selectedCategory.value) {
      await updateCategory(selectedCategory.value.id, payload)
    } else {
      await createCategory(payload as CreateCategoryPayload)
    }

    activeType.value = form.type
    isCategoryDialogVisible.value = false
    resetForm(form.type)
    await reloadFromStart()
  } catch (error) {
    formError.value = getErrorMessage(error, 'Failed to save category.')
  } finally {
    isSaving.value = false
  }
}

async function handleDeleteCategory() {
  if (!categoryToDelete.value || categoryToDelete.value.is_default) {
    return
  }

  isDeleting.value = true
  deleteError.value = ''

  try {
    await deleteCategory(categoryToDelete.value.id)
    closeDeleteDialog()
    await reloadFromStart()
  } catch (error) {
    deleteError.value = getErrorMessage(error, 'Failed to delete category.')
  } finally {
    isDeleting.value = false
  }
}

onMounted(async () => {
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
        <p class="page-kicker">Categories</p>
        <h1 class="page-title">Manage categories</h1>
        <p class="page-subtitle">
          Keep expense and income categories organized for cleaner tracking.
        </p>
      </div>

      <Button
        label="Add Category"
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
          @click="loadCategories"
        />
      </div>
    </Message>

    <section class="content-panel" aria-labelledby="categories-table-title">
      <div class="panel-toolbar">
        <div>
          <h2 id="categories-table-title" class="panel-title">{{ panelTitle }}</h2>
          <p class="panel-meta">
            {{ filteredCategories.length }} categories
          </p>
        </div>

        <SelectButton
          v-model="activeType"
          :options="categoryTypes"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>

      <DataTable
        :value="filteredCategories"
        data-key="id"
        :loading="isLoading"
        striped-rows
        responsive-layout="scroll"
      >
        <Column field="name" header="Name">
          <template #body="{ data }">
            <div class="category-name-cell">
              <span
                class="category-color-dot"
                :style="{ backgroundColor: data.color ?? '#d7dde5' }"
                aria-hidden="true"
              ></span>
              <span class="category-icon" aria-hidden="true">
                <i v-if="isPrimeIcon(data.icon)" :class="data.icon"></i>
                <span v-else-if="isEmojiIcon(data.icon)">{{ data.icon }}</span>
                <span v-else class="muted-cell">–</span>
              </span>
              <span>{{ data.name }}</span>
            </div>
          </template>
        </Column>
        <Column field="type" header="Type">
          <template #body="{ data }">
            <Tag
              :value="data.type === 'expense' ? 'Expense' : 'Income'"
              :severity="data.type === 'expense' ? 'danger' : 'success'"
            />
          </template>
        </Column>
        <Column field="is_default" header="Default">
          <template #body="{ data }">
            <Tag
              :value="data.is_default ? 'Default' : 'Custom'"
              :severity="data.is_default ? 'info' : 'secondary'"
            />
          </template>
        </Column>
        <Column field="updated_at" header="Updated">
          <template #body="{ data }">
            <span class="muted-cell">
              {{ formatUpdatedDate(data.updated_at) }}
            </span>
          </template>
        </Column>
        <Column header="Actions" frozen align-frozen="right">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                severity="secondary"
                aria-label="Edit category"
                v-tooltip.top="'Edit category'"
                @click="openEditDialog(data)"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                aria-label="Delete category"
                v-tooltip.top="
                  data.is_default ? 'Default categories cannot be deleted' : 'Delete category'
                "
                :disabled="data.is_default"
                @click="openDeleteDialog(data)"
              />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="table-empty">No {{ activeType }} categories yet.</div>
        </template>
      </DataTable>

      <div ref="sentinel" class="scroll-sentinel">
        <ProgressSpinner v-if="isLoadingMore" style="width: 32px; height: 32px" stroke-width="4" />
        <span v-else-if="!hasMore && categories.length" class="scroll-end">End of list</span>
      </div>
    </section>

    <Dialog
      v-model:visible="isCategoryDialogVisible"
      modal
      dismissable-mask
      :header="dialogTitle"
      :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    >
      <form class="dialog-form" @submit.prevent="handleSaveCategory">
        <Message v-if="formError" severity="error" :closable="false">
          {{ formError }}
        </Message>

        <div class="field">
          <label for="category-name">Name</label>
          <InputText
            id="category-name"
            v-model="form.name"
            class="w-full"
            placeholder="Groceries"
            :disabled="isSaving"
          />
        </div>

        <div class="field">
          <label for="category-type">Type</label>
          <Dropdown
            id="category-type"
            v-model="form.type"
            class="w-full"
            :options="categoryTypes"
            option-label="label"
            option-value="value"
            :disabled="isSaving"
          />
        </div>

        <div class="field">
          <div class="icon-label-row">
            <label>Icon</label>
            <Button
              v-if="form.icon"
              type="button"
              label="Clear"
              size="small"
              text
              :disabled="isSaving"
              @click="form.icon = ''"
            />
          </div>
          <div class="emoji-swatches" aria-label="Category icon emojis">
            <button
              v-for="emoji in categoryEmojis"
              :key="emoji"
              type="button"
              class="emoji-swatch"
              :class="{ 'is-active': form.icon === emoji }"
              :disabled="isSaving"
              @click="chooseEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="category-color">Color</label>
          <div class="color-control">
            <input
              id="category-color"
              v-model="form.color"
              class="native-color-input"
              type="color"
              :disabled="isSaving"
            />
            <InputText
              v-model="form.color"
              class="w-full"
              placeholder="#116466"
              :disabled="isSaving"
            />
          </div>

          <div class="color-swatches" aria-label="Color swatches">
            <button
              v-for="color in colorSwatches"
              :key="color"
              class="color-swatch"
              type="button"
              :class="{ 'is-active': form.color.toLowerCase() === color.toLowerCase() }"
              :style="{ backgroundColor: color }"
              :aria-label="`Use ${color}`"
              :disabled="isSaving"
              @click="chooseSwatch(color)"
            ></button>
          </div>
        </div>

        <div class="form-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            :disabled="isSaving"
            @click="closeCategoryDialog"
          />
          <Button
            type="submit"
            :label="dialogMode === 'create' ? 'Create' : 'Save'"
            icon="pi pi-check"
            :loading="isSaving"
            :disabled="isFormInvalid"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="isDeleteDialogVisible"
      modal
      dismissable-mask
      header="Delete Category"
      :style="{ width: 'min(460px, calc(100vw - 32px))' }"
    >
      <div class="dialog-form">
        <Message v-if="deleteError" severity="error" :closable="false">
          {{ deleteError }}
        </Message>

        <p class="confirm-copy">
          Delete <strong>{{ categoryToDelete?.name }}</strong>? This action cannot be undone.
        </p>

        <div class="form-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            outlined
            :disabled="isDeleting"
            @click="closeDeleteDialog"
          />
          <Button
            type="button"
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            :loading="isDeleting"
            @click="handleDeleteCategory"
          />
        </div>
      </div>
    </Dialog>
  </section>
</template>

<style scoped>
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

.icon-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.emoji-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.emoji-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 1.25rem;
  line-height: 1;
  border: 1px solid var(--p-content-border-color, #cbd5df);
  border-radius: 8px;
  background: var(--p-content-background, #ffffff);
  cursor: pointer;
}

.emoji-swatch:hover:not(:disabled) {
  border-color: #116466;
}

.emoji-swatch.is-active {
  border-color: #116466;
  box-shadow: 0 0 0 2px rgba(17, 100, 102, 0.35);
}

.emoji-swatch:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
