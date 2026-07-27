<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { FileSearchMatch, FolderSearchRequest } from '@shared/search-types'
import { searchInText } from '@shared/text-search'

import { LruHistory } from '../search/lru-history'

export interface OpenTabInfo {
  id: string
  sourceKey: string
  sourceLabel: string
  filePath?: string
  markdownText: string
}

export interface SearchNavigatePayload {
  filePath: string
  lineNumber: number
  column: number
  tabId?: string
}

const SEARCH_HISTORY_STORAGE_KEY = 'md-reader-search-history-v1'
const SEARCH_HISTORY_CAPACITY = 20
const FOLDER_SEARCH_MAX_RESULTS = 500

const props = defineProps<{
  openTabs: OpenTabInfo[]
  activeTabFilePath?: string
  supportsPathOpen: boolean
}>()

const emit = defineEmits<{
  navigate: [payload: SearchNavigatePayload]
  close: []
}>()

type SearchScope = 'openTabs' | 'folder'

const searchHistory = new LruHistory(SEARCH_HISTORY_STORAGE_KEY, SEARCH_HISTORY_CAPACITY)

const searchQuery = ref('')
const searchIsRegex = ref(false)
const searchCaseSensitive = ref(false)
const searchScope = ref<SearchScope>('openTabs')
const searchExcludeFolders = ref('')
const searchResults = ref<FileSearchMatch[]>([])
const searchIsRunning = ref(false)
const searchStatusText = ref('')
const searchShowHistory = ref(false)
const searchHistoryItems = ref<string[]>(searchHistory.getAll())
const searchSelectedIndex = ref(-1)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchResultsListRef = ref<HTMLOListElement | null>(null)

let searchRequestId = 0

const searchHasResults = computed(() => searchResults.value.length > 0)
const searchFolderPath = computed(() => {
  if (!props.activeTabFilePath) {
    return ''
  }
  const lastSep = Math.max(
    props.activeTabFilePath.lastIndexOf('/'),
    props.activeTabFilePath.lastIndexOf('\\')
  )
  return lastSep > 0 ? props.activeTabFilePath.substring(0, lastSep) : ''
})
const searchCanSearchFolder = computed(
  () => props.supportsPathOpen && searchFolderPath.value.length > 0
)

const searchGroupedResults = computed(() => {
  const groups: Array<{ filePath: string; label: string; matches: FileSearchMatch[] }> = []
  const map = new Map<string, FileSearchMatch[]>()

  for (const match of searchResults.value) {
    let list = map.get(match.filePath)
    if (!list) {
      list = []
      map.set(match.filePath, list)
      groups.push({ filePath: match.filePath, label: extractFileLabel(match.filePath), matches: list })
    }
    list.push(match)
  }

  return groups
})

watch(searchScope, () => {
  searchResults.value = []
  searchStatusText.value = ''
  searchSelectedIndex.value = -1
})

function focusSearchInput(): void {
  void nextTick(() => {
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
  })
}

onMounted(() => {
  focusSearchInput()
})

onBeforeUnmount(() => {
  searchRequestId++
})

function handleSearchInputKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (searchShowHistory.value) {
      searchShowHistory.value = false
      return
    }
    emit('close')
    return
  }

  if (event.key === 'Enter') {
    if (searchShowHistory.value && searchSelectedIndex.value >= 0 && searchSelectedIndex.value < searchHistoryItems.value.length) {
      searchQuery.value = searchHistoryItems.value[searchSelectedIndex.value]
    }
    searchShowHistory.value = false
    void executeSearch()
    return
  }

  if (event.key === 'ArrowDown' && searchShowHistory.value && searchHistoryItems.value.length > 0) {
    event.preventDefault()
    searchSelectedIndex.value = Math.min(
      searchSelectedIndex.value + 1,
      searchHistoryItems.value.length - 1
    )
    return
  }

  if (event.key === 'ArrowUp' && searchShowHistory.value && searchHistoryItems.value.length > 0) {
    event.preventDefault()
    searchSelectedIndex.value = Math.max(searchSelectedIndex.value - 1, 0)
    return
  }
}

function handleHistorySelect(item: string): void {
  searchQuery.value = item
  searchShowHistory.value = false
  void executeSearch()
}

function handleHistoryRemove(item: string, event: Event): void {
  event.stopPropagation()
  searchHistory.remove(item)
  searchHistoryItems.value = searchHistory.getAll()
}

function handleSearchInputFocus(): void {
  if (searchHistoryItems.value.length > 0) {
    searchShowHistory.value = true
    searchSelectedIndex.value = -1
  }
}

function handleSearchInputBlur(): void {
  setTimeout(() => {
    searchShowHistory.value = false
  }, 200)
}

async function executeSearch(): Promise<void> {
  const query = searchQuery.value.trim()
  if (!query) {
    searchStatusText.value = '请输入搜索内容'
    return
  }

  if (searchIsRegex.value) {
    try {
      new RegExp(query)
    } catch {
      searchStatusText.value = '正则表达式语法错误'
      return
    }
  }

  searchHistory.push(query)
  searchHistoryItems.value = searchHistory.getAll()

  const currentRequestId = ++searchRequestId
  searchIsRunning.value = true
  searchResults.value = []
  searchStatusText.value = '搜索中...'

  try {
    if (searchScope.value === 'openTabs') {
      await searchOpenTabs(query, currentRequestId)
    } else {
      await searchFolder(query, currentRequestId)
    }
  } catch (error) {
    if (currentRequestId === searchRequestId) {
      searchStatusText.value = `搜索出错：${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    if (currentRequestId === searchRequestId) {
      searchIsRunning.value = false
    }
  }
}

async function searchOpenTabs(query: string, requestId: number): Promise<void> {
  const allMatches: FileSearchMatch[] = []

  for (const tab of props.openTabs) {
    if (requestId !== searchRequestId) {
      return
    }

    const textMatches = searchInText(
      tab.markdownText,
      query,
      searchIsRegex.value,
      searchCaseSensitive.value,
      FOLDER_SEARCH_MAX_RESULTS - allMatches.length
    )

    for (const match of textMatches) {
      allMatches.push({
        ...match,
        filePath: tab.filePath ?? tab.sourceKey
      })
    }

    if (allMatches.length >= FOLDER_SEARCH_MAX_RESULTS) {
      break
    }
  }

  if (requestId !== searchRequestId) {
    return
  }

  searchResults.value = allMatches
  searchStatusText.value = allMatches.length > 0
    ? `在 ${props.openTabs.length} 个标签页中找到 ${allMatches.length} 个结果`
    : '未找到匹配结果'
}

async function searchFolder(query: string, requestId: number): Promise<void> {
  if (!searchCanSearchFolder.value) {
    searchStatusText.value = '当前标签页无文件路径，无法搜索文件夹'
    return
  }

  const excludeFolders = searchExcludeFolders.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const request: FolderSearchRequest = {
    query,
    isRegex: searchIsRegex.value,
    caseSensitive: searchCaseSensitive.value,
    folderPath: searchFolderPath.value,
    excludeFolders,
    maxResults: FOLDER_SEARCH_MAX_RESULTS
  }

  const result = await window.electronAPI.searchInFolder(request)

  if (requestId !== searchRequestId) {
    return
  }

  searchResults.value = result.matches
  const truncatedNote = result.truncated ? '（结果已截断）' : ''
  searchStatusText.value = result.matches.length > 0
    ? `在 ${result.searchedFiles} 个文件中找到 ${result.matches.length} 个结果${truncatedNote}`
    : `在 ${result.searchedFiles} 个文件中未找到匹配结果`
}

function handleResultClick(match: FileSearchMatch): void {
  const tab = props.openTabs.find(
    (t) => t.filePath === match.filePath || t.sourceKey === match.filePath
  )

  emit('navigate', {
    filePath: match.filePath,
    lineNumber: match.lineNumber,
    column: match.column,
    tabId: tab?.id
  })
}

function extractFileLabel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const lastSegment = normalized.split('/').filter(Boolean).at(-1)
  return lastSegment || filePath
}

function buildResultPreviewHtml(match: FileSearchMatch): string {
  const preview = buildTruncatedPreview(match.lineText, match.matchText, match.column)
  const col = preview.adjustedColumn
  const text = preview.text
  const beforeMatch = escapeHtml(text.substring(0, col - 1))
  const matchPart = escapeHtml(text.substring(col - 1, col - 1 + match.matchText.length))
  const afterMatch = escapeHtml(text.substring(col - 1 + match.matchText.length))
  return `${beforeMatch}<mark class="md-search-result-highlight">${matchPart}</mark>${afterMatch}`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface TruncatedPreview {
  text: string
  adjustedColumn: number
}

function buildTruncatedPreview(lineText: string, matchText: string, column: number): TruncatedPreview {
  const maxLen = 120
  if (lineText.length <= maxLen) {
    return { text: lineText, adjustedColumn: column }
  }

  const start = Math.max(0, column - 40)
  const end = Math.min(lineText.length, start + maxLen)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < lineText.length ? '...' : ''
  const text = prefix + lineText.substring(start, end) + suffix
  const adjustedColumn = (column - start) + prefix.length
  return { text, adjustedColumn }
}

defineExpose({ focusSearchInput })
</script>

<template>
  <div class="md-search-panel-root">
    <div class="md-search-panel-header">
      <h3 class="md-search-panel-title">搜索</h3>
      <button type="button" class="md-search-panel-close-button" aria-label="关闭搜索" @click="$emit('close')">
        ×
      </button>
    </div>

    <div class="md-search-panel-controls">
      <div class="md-search-input-wrapper">
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="md-search-input"
          type="text"
          placeholder="搜索内容..."
          autocomplete="off"
          spellcheck="false"
          @keydown="handleSearchInputKeydown"
          @focus="handleSearchInputFocus"
          @blur="handleSearchInputBlur"
        />
        <div v-if="searchShowHistory && searchHistoryItems.length > 0" class="md-search-history-dropdown">
          <button
            v-for="(item, index) in searchHistoryItems"
            :key="item"
            type="button"
            class="md-search-history-item"
            :class="{ 'md-search-history-item-selected': index === searchSelectedIndex }"
            @mousedown.prevent="handleHistorySelect(item)"
          >
            <span class="md-search-history-item-text">{{ item }}</span>
            <span
              class="md-search-history-item-remove"
              role="button"
              aria-label="删除历史记录"
              @mousedown.prevent.stop="handleHistoryRemove(item, $event)"
            >×</span>
          </button>
        </div>
      </div>

      <div class="md-search-options-row">
        <label class="md-search-option-label">
          <input v-model="searchIsRegex" type="checkbox" class="md-search-option-checkbox" />
          正则
        </label>
        <label class="md-search-option-label">
          <input v-model="searchCaseSensitive" type="checkbox" class="md-search-option-checkbox" />
          区分大小写
        </label>
      </div>

      <div class="md-search-scope-row">
        <label class="md-search-scope-label">
          <input v-model="searchScope" type="radio" value="openTabs" name="search-scope" class="md-search-scope-radio" />
          已打开文件
        </label>
        <label v-if="searchCanSearchFolder" class="md-search-scope-label">
          <input v-model="searchScope" type="radio" value="folder" name="search-scope" class="md-search-scope-radio" />
          文件夹
        </label>
      </div>

      <template v-if="searchScope === 'folder' && searchCanSearchFolder">
        <div class="md-search-folder-info">
          <span class="md-search-folder-path-label">搜索路径：</span>
          <span class="md-search-folder-path-value" :title="searchFolderPath">{{ searchFolderPath }}</span>
        </div>
        <input
          v-model="searchExcludeFolders"
          class="md-search-exclude-input"
          type="text"
          placeholder="排除文件夹（逗号分隔，如 dist,build）"
          autocomplete="off"
        />
      </template>

      <button
        type="button"
        class="md-search-execute-button"
        :disabled="searchIsRunning || !searchQuery.trim()"
        @click="executeSearch"
      >
        {{ searchIsRunning ? '搜索中...' : '搜索' }}
      </button>
    </div>

    <p class="md-search-status-text" role="status">{{ searchStatusText }}</p>

    <div v-if="searchHasResults" class="md-search-results-container">
      <div v-for="group in searchGroupedResults" :key="group.filePath" class="md-search-result-group">
        <div class="md-search-result-group-header" :title="group.filePath">
          <span class="md-search-result-group-label">{{ group.label }}</span>
          <span class="md-search-result-group-count">{{ group.matches.length }}</span>
        </div>
        <ol ref="searchResultsListRef" class="md-search-result-list">
          <li
            v-for="(match, matchIndex) in group.matches"
            :key="`${match.lineNumber}:${match.column}:${matchIndex}`"
            class="md-search-result-item"
            @click="handleResultClick(match)"
          >
            <span class="md-search-result-location">{{ match.lineNumber }}:{{ match.column }}</span>
            <span
              class="md-search-result-preview"
              v-html="buildResultPreviewHtml(match)"
            ></span>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.md-search-panel-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 100%;
  overflow: hidden;
}

.md-search-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.md-search-panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #3e3321;
}

.md-search-panel-close-button {
  width: 28px;
  height: 28px;
  border: 1px solid #d2c5a6;
  border-radius: 6px;
  background: transparent;
  color: #544a35;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.md-search-panel-close-button:hover {
  background: rgba(140, 122, 87, 0.12);
}

.md-search-panel-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.md-search-input-wrapper {
  position: relative;
}

.md-search-input {
  width: 100%;
  min-height: 36px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid #d2c5a6;
  border-radius: 8px;
  background: #ffffff;
  color: #1f1b14;
  font-size: 13px;
}

.md-search-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(107, 82, 32, 0.2);
}

.md-search-history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #d2c5a6;
  border-radius: 8px;
  background: #fffcf5;
  box-shadow: 0 4px 16px rgba(62, 49, 20, 0.15);
  margin-top: 2px;
}

.md-search-history-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: 0;
  background: transparent;
  color: #1f1b14;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.md-search-history-item:hover,
.md-search-history-item-selected {
  background: rgba(107, 82, 32, 0.08);
}

.md-search-history-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.md-search-history-item-remove {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  color: #8c7a57;
  cursor: pointer;
}

.md-search-history-item-remove:hover {
  background: rgba(140, 122, 87, 0.2);
  color: #3e3321;
}

.md-search-options-row,
.md-search-scope-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.md-search-option-label,
.md-search-scope-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #544a35;
  cursor: pointer;
  user-select: none;
}

.md-search-option-checkbox,
.md-search-scope-radio {
  margin: 0;
  cursor: pointer;
}

.md-search-folder-info {
  font-size: 12px;
  color: #544a35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md-search-folder-path-label {
  font-weight: 600;
}

.md-search-folder-path-value {
  word-break: break-all;
}

.md-search-exclude-input {
  width: 100%;
  min-height: 30px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid #d2c5a6;
  border-radius: 6px;
  background: #ffffff;
  color: #1f1b14;
  font-size: 12px;
}

.md-search-exclude-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(107, 82, 32, 0.2);
}

.md-search-execute-button {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid #8c7a57;
  border-radius: 8px;
  background: linear-gradient(180deg, #fffdf7 0%, #f6edd9 100%);
  color: #1f1b14;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease;
  box-shadow: 0 2px 8px rgba(57, 45, 20, 0.1);
}

.md-search-execute-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(57, 45, 20, 0.16);
}

.md-search-execute-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.md-search-status-text {
  margin: 0;
  font-size: 12px;
  color: #544a35;
}

.md-search-results-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.md-search-result-group {
  margin-bottom: 4px;
}

.md-search-result-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  background: rgba(107, 82, 32, 0.06);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #6b5220;
  position: sticky;
  top: 0;
  z-index: 1;
}

.md-search-result-group-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.md-search-result-group-count {
  flex-shrink: 0;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(107, 82, 32, 0.12);
  font-size: 11px;
}

.md-search-result-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.md-search-result-item {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 6px;
  padding: 4px 6px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
}

.md-search-result-item:hover {
  background: rgba(107, 82, 32, 0.08);
}

.md-search-result-location {
  color: #8c7a57;
  font-family: monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.md-search-result-preview {
  color: #1f1b14;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  font-size: 12px;
}

:deep(.md-search-result-highlight) {
  background: #f7d070;
  color: #1f1b14;
  border-radius: 2px;
  padding: 0 1px;
}

@media (prefers-reduced-motion: reduce) {
  .md-search-execute-button {
    transition: none;
  }
}
</style>
