<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { parseMarkdownDocument } from '@shared/markdown-parser'
import { DEFAULT_READER_PREFERENCE } from '@shared/reader-defaults'
import { READER_THEME_OPTIONS } from '@shared/reader-themes'
import type {
  ParsedDocument,
  ReaderLastOpenedSession,
  ReaderPosition,
  ReaderPreference,
  ReaderThemeKey
} from '@shared/reader-types'

import ChapterList from './components/ChapterList.vue'
import ReaderArticle from './components/ReaderArticle.vue'
import ReaderSettings from './components/ReaderSettings.vue'

const sampleFilePath =
  '/Users/hunter/Downloads/toutiao/books/倚天：重生张无忌，多情公子-7379149479284329496.decoded.md'

const READER_PREFERENCE_STORAGE_KEY = 'md-reader-preference-v1'
const READER_POSITION_STORAGE_KEY = 'md-reader-position-v1'
const READER_LAST_OPENED_STORAGE_KEY = 'md-reader-last-opened-v1'
const READER_LAST_BOOK_TEXT_STORAGE_KEY = 'md-reader-last-book-text-v1'

const READER_CACHE_DB_NAME = 'md-reader-cache-db'
const READER_CACHE_STORE_NAME = 'reader-cache-store'
const READER_CACHE_LAST_BOOK_KEY = 'last-book-v1'

const COMPACT_LAYOUT_MEDIA_QUERY = '(max-width: 900px)'

interface ReaderCachedBookSnapshot {
  sourceKey: string
  sourceLabel: string
  markdownText: string
  savedAt: number
}

const mdReaderPathInputModel = ref(sampleFilePath)
const mdReaderCurrentSourceKey = ref('')
const mdReaderParsedDocument = ref<ParsedDocument | null>(null)
const mdReaderActiveChapterIndex = ref(0)
const mdReaderRestoredScrollTop = ref(0)
const mdReaderLatestScrollTop = ref(0)
const mdReaderPreference = ref<ReaderPreference>({ ...DEFAULT_READER_PREFERENCE })
const mdReaderStatusText = ref('请选择 Markdown 文件，或在桌面端输入路径打开。')
const mdReaderIsLoading = ref(false)
const mdReaderIsCompactLayout = ref(false)
const mdReaderIsConfigOpen = ref(false)
const mdReaderWebFileInputRef = ref<HTMLInputElement | null>(null)
const mdReaderSupportsPathOpen = computed(() => Boolean(window.electronAPI))

const mdReaderChapterItems = computed(() => mdReaderParsedDocument.value?.chapters ?? [])
const mdReaderCurrentChapter = computed(() => mdReaderChapterItems.value[mdReaderActiveChapterIndex.value] ?? null)
const mdReaderHasPreviousChapter = computed(() => mdReaderActiveChapterIndex.value > 0)
const mdReaderHasNextChapter = computed(() => mdReaderActiveChapterIndex.value < mdReaderChapterItems.value.length - 1)
const mdReaderHasLoadedDocument = computed(() => mdReaderParsedDocument.value !== null)
const mdReaderCompactReadingMode = computed(
  () => mdReaderIsCompactLayout.value && mdReaderHasLoadedDocument.value && !mdReaderIsConfigOpen.value
)
const mdReaderShowsConfigPanel = computed(
  () => !mdReaderIsCompactLayout.value || mdReaderIsConfigOpen.value || !mdReaderHasLoadedDocument.value
)
const mdReaderChapterProgressText = computed(() => {
  if (mdReaderChapterItems.value.length === 0) {
    return '未加载章节'
  }

  return `第 ${mdReaderActiveChapterIndex.value + 1} / ${mdReaderChapterItems.value.length} 章`
})
const mdReaderPrevButtonText = computed(() => (mdReaderIsCompactLayout.value ? '上一章' : '上一章（Ctrl+←）'))
const mdReaderNextButtonText = computed(() => (mdReaderIsCompactLayout.value ? '下一章' : '下一章（Ctrl+→）'))
const mdReaderShowFloatingConfigButton = computed(() => mdReaderIsCompactLayout.value && mdReaderHasLoadedDocument.value)
const mdReaderFloatingConfigButtonText = computed(() => (mdReaderIsConfigOpen.value ? '继续阅读' : '配置'))

let savePositionTimer: number | null = null
let compactLayoutMediaQuery: MediaQueryList | null = null

onMounted(() => {
  setupCompactLayoutWatcher()
  void loadPreference()
  void restoreLastReadingSession()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  teardownCompactLayoutWatcher()

  if (savePositionTimer !== null) {
    window.clearTimeout(savePositionTimer)
    savePositionTimer = null
  }

  void persistReaderPosition(mdReaderLatestScrollTop.value)
})

function setupCompactLayoutWatcher(): void {
  compactLayoutMediaQuery = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY)
  mdReaderIsCompactLayout.value = compactLayoutMediaQuery.matches

  if (typeof compactLayoutMediaQuery.addEventListener === 'function') {
    compactLayoutMediaQuery.addEventListener('change', handleCompactLayoutChange)
    return
  }

  compactLayoutMediaQuery.addListener(handleCompactLayoutChange)
}

function teardownCompactLayoutWatcher(): void {
  if (!compactLayoutMediaQuery) {
    return
  }

  if (typeof compactLayoutMediaQuery.removeEventListener === 'function') {
    compactLayoutMediaQuery.removeEventListener('change', handleCompactLayoutChange)
  } else {
    compactLayoutMediaQuery.removeListener(handleCompactLayoutChange)
  }

  compactLayoutMediaQuery = null
}

function handleCompactLayoutChange(event: MediaQueryListEvent): void {
  mdReaderIsCompactLayout.value = event.matches

  if (!event.matches) {
    mdReaderIsConfigOpen.value = false
  }
}

function openReaderConfig(): void {
  mdReaderIsConfigOpen.value = true
}

function closeReaderConfig(): void {
  mdReaderIsConfigOpen.value = false
}

function toggleReaderConfig(): void {
  if (mdReaderIsConfigOpen.value) {
    closeReaderConfig()
    return
  }

  openReaderConfig()
}

async function openMarkdownByDialog(): Promise<void> {
  if (!mdReaderSupportsPathOpen.value) {
    mdReaderWebFileInputRef.value?.click()
    return
  }

  const filePath = await window.electronAPI.pickMarkdownFile()
  if (!filePath) {
    return
  }

  mdReaderPathInputModel.value = filePath
  await loadMarkdownFile(filePath)
}

async function openMarkdownByPath(): Promise<void> {
  if (!mdReaderSupportsPathOpen.value) {
    mdReaderStatusText.value = '当前环境不支持按路径读取，请使用“选择文件”。'
    return
  }

  const filePath = mdReaderPathInputModel.value.trim()

  if (!filePath) {
    mdReaderStatusText.value = '请输入有效的 Markdown 文件路径。'
    return
  }

  await loadMarkdownFile(filePath)
}

async function loadMarkdownFile(filePath: string): Promise<void> {
  if (!mdReaderSupportsPathOpen.value) {
    mdReaderStatusText.value = '当前运行环境不支持 Electron 路径读取。'
    return
  }

  try {
    const markdownText = await window.electronAPI.readMarkdownFile(filePath)
    await loadMarkdownContent(filePath, filePath, markdownText)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    mdReaderStatusText.value = `加载失败：${message}`
  }
}

async function handleWebFileInputChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const markdownText = await file.text()
    const sourceKey = `web-file:${file.name}:${file.size}:${file.lastModified}`
    await loadMarkdownContent(sourceKey, file.name, markdownText)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    mdReaderStatusText.value = `加载失败：${message}`
  } finally {
    input.value = ''
  }
}

async function loadMarkdownContent(sourceKey: string, sourceLabel: string, markdownText: string): Promise<void> {
  mdReaderIsLoading.value = true

  try {
    const parsed = parseMarkdownDocument(markdownText, sourceLabel)

    mdReaderParsedDocument.value = parsed
    mdReaderCurrentSourceKey.value = sourceKey

    const savedPosition = await loadReaderPosition(sourceKey)
    const chapterLength = parsed.chapters.length
    const safeChapterIndex = clampNumber(savedPosition?.chapterIndex ?? 0, 0, Math.max(chapterLength - 1, 0))

    mdReaderActiveChapterIndex.value = safeChapterIndex
    mdReaderRestoredScrollTop.value = Math.max(savedPosition?.scrollTop ?? 0, 0)
    mdReaderLatestScrollTop.value = mdReaderRestoredScrollTop.value

    await saveLastOpenedSession(buildLastOpenedSession(sourceKey, sourceLabel))

    if (!mdReaderSupportsPathOpen.value) {
      await saveLastBookSnapshot({
        sourceKey,
        sourceLabel,
        markdownText,
        savedAt: Date.now()
      })
    }

    mdReaderStatusText.value = `已加载：${sourceLabel}（${chapterLength} 章）`

    if (mdReaderIsCompactLayout.value && chapterLength > 0) {
      closeReaderConfig()
    }
  } finally {
    mdReaderIsLoading.value = false
  }
}

function buildLastOpenedSession(sourceKey: string, sourceLabel: string): ReaderLastOpenedSession {
  if (mdReaderSupportsPathOpen.value) {
    return {
      sourceType: 'path',
      sourceKey,
      sourceLabel,
      filePath: sourceKey
    }
  }

  return {
    sourceType: 'cachedText',
    sourceKey,
    sourceLabel
  }
}

async function restoreLastReadingSession(): Promise<void> {
  const lastOpened = await loadLastOpenedSession()

  if (!lastOpened) {
    return
  }

  if (lastOpened.sourceType === 'path' && mdReaderSupportsPathOpen.value && lastOpened.filePath) {
    mdReaderPathInputModel.value = lastOpened.filePath

    try {
      await loadMarkdownFile(lastOpened.filePath)
      mdReaderStatusText.value = `已自动恢复：${lastOpened.sourceLabel}`
    } catch {
      mdReaderStatusText.value = `未能自动恢复上次文件：${lastOpened.sourceLabel}`
    }

    return
  }

  if (lastOpened.sourceType === 'cachedText' && !mdReaderSupportsPathOpen.value) {
    const snapshot = await loadLastBookSnapshot()
    if (!snapshot) {
      return
    }

    if (snapshot.sourceKey !== lastOpened.sourceKey) {
      return
    }

    await loadMarkdownContent(snapshot.sourceKey, snapshot.sourceLabel, snapshot.markdownText)
    mdReaderStatusText.value = `已自动恢复：${snapshot.sourceLabel}`
  }
}

async function handleChapterSwitch(index: number): Promise<void> {
  if (mdReaderChapterItems.value.length === 0) {
    return
  }

  const safeIndex = clampNumber(index, 0, mdReaderChapterItems.value.length - 1)
  mdReaderActiveChapterIndex.value = safeIndex
  mdReaderRestoredScrollTop.value = 0
  mdReaderLatestScrollTop.value = 0

  await persistReaderPosition(0)

  if (mdReaderIsCompactLayout.value) {
    closeReaderConfig()
  }
}

async function goToPreviousChapter(): Promise<void> {
  if (!mdReaderHasPreviousChapter.value) {
    return
  }

  await handleChapterSwitch(mdReaderActiveChapterIndex.value - 1)
}

async function goToNextChapter(): Promise<void> {
  if (!mdReaderHasNextChapter.value) {
    return
  }

  await handleChapterSwitch(mdReaderActiveChapterIndex.value + 1)
}

function handleReaderScrollChange(scrollTop: number): void {
  mdReaderLatestScrollTop.value = Math.max(scrollTop, 0)

  if (savePositionTimer !== null) {
    window.clearTimeout(savePositionTimer)
  }

  savePositionTimer = window.setTimeout(() => {
    void persistReaderPosition(mdReaderLatestScrollTop.value)
  }, 150)
}

async function handlePreferenceChange(value: ReaderPreference): Promise<void> {
  mdReaderPreference.value = normalizeReaderPreference(value)
  await saveReaderPreference(mdReaderPreference.value)
}

async function loadPreference(): Promise<void> {
  const savedPreference = await loadReaderPreference()

  if (savedPreference) {
    mdReaderPreference.value = normalizeReaderPreference(savedPreference)
  }
}

async function persistReaderPosition(scrollTop: number): Promise<void> {
  if (!mdReaderCurrentSourceKey.value) {
    return
  }

  await saveReaderPosition(mdReaderCurrentSourceKey.value, {
    chapterIndex: mdReaderActiveChapterIndex.value,
    scrollTop: Math.max(scrollTop, 0)
  })
}

async function loadReaderPosition(sourceKey: string): Promise<ReaderPosition | null> {
  if (mdReaderSupportsPathOpen.value) {
    return window.electronAPI.loadReaderPosition(sourceKey)
  }

  return loadWebStorePositions()[sourceKey] ?? null
}

async function saveReaderPosition(sourceKey: string, value: ReaderPosition): Promise<void> {
  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveReaderPosition(sourceKey, value)
    return
  }

  const positions = loadWebStorePositions()
  positions[sourceKey] = value
  safeLocalStorageSet(READER_POSITION_STORAGE_KEY, JSON.stringify(positions))
}

async function loadReaderPreference(): Promise<ReaderPreference | null> {
  if (mdReaderSupportsPathOpen.value) {
    return window.electronAPI.loadReaderPreference()
  }

  const raw = safeLocalStorageGet(READER_PREFERENCE_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as ReaderPreference
  } catch {
    return null
  }
}

async function saveReaderPreference(value: ReaderPreference): Promise<void> {
  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveReaderPreference(value)
    return
  }

  safeLocalStorageSet(READER_PREFERENCE_STORAGE_KEY, JSON.stringify(value))
}

async function loadLastOpenedSession(): Promise<ReaderLastOpenedSession | null> {
  if (mdReaderSupportsPathOpen.value) {
    return window.electronAPI.loadLastOpenedSession()
  }

  const raw = safeLocalStorageGet(READER_LAST_OPENED_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return normalizeLastOpenedSession(JSON.parse(raw))
  } catch {
    return null
  }
}

async function saveLastOpenedSession(value: ReaderLastOpenedSession | null): Promise<void> {
  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveLastOpenedSession(value)
    return
  }

  if (!value) {
    safeLocalStorageRemove(READER_LAST_OPENED_STORAGE_KEY)
    return
  }

  safeLocalStorageSet(READER_LAST_OPENED_STORAGE_KEY, JSON.stringify(value))
}

async function loadLastBookSnapshot(): Promise<ReaderCachedBookSnapshot | null> {
  const indexedValue = await readReaderCacheValue(READER_CACHE_LAST_BOOK_KEY)
  const normalizedIndexed = normalizeCachedBookSnapshot(indexedValue)

  if (normalizedIndexed) {
    return normalizedIndexed
  }

  const raw = safeLocalStorageGet(READER_LAST_BOOK_TEXT_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return normalizeCachedBookSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

async function saveLastBookSnapshot(value: ReaderCachedBookSnapshot): Promise<void> {
  await writeReaderCacheValue(READER_CACHE_LAST_BOOK_KEY, value)
  safeLocalStorageSet(READER_LAST_BOOK_TEXT_STORAGE_KEY, JSON.stringify(value))
}

function normalizeLastOpenedSession(raw: unknown): ReaderLastOpenedSession | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Partial<ReaderLastOpenedSession>
  if (candidate.sourceType !== 'path' && candidate.sourceType !== 'cachedText') {
    return null
  }

  if (typeof candidate.sourceKey !== 'string' || typeof candidate.sourceLabel !== 'string') {
    return null
  }

  if (candidate.sourceType === 'path') {
    if (typeof candidate.filePath !== 'string' || candidate.filePath.length === 0) {
      return null
    }

    return {
      sourceType: 'path',
      sourceKey: candidate.sourceKey,
      sourceLabel: candidate.sourceLabel,
      filePath: candidate.filePath
    }
  }

  return {
    sourceType: 'cachedText',
    sourceKey: candidate.sourceKey,
    sourceLabel: candidate.sourceLabel
  }
}

function normalizeCachedBookSnapshot(raw: unknown): ReaderCachedBookSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Partial<ReaderCachedBookSnapshot>
  if (typeof candidate.sourceKey !== 'string' || typeof candidate.sourceLabel !== 'string' || typeof candidate.markdownText !== 'string') {
    return null
  }

  return {
    sourceKey: candidate.sourceKey,
    sourceLabel: candidate.sourceLabel,
    markdownText: candidate.markdownText,
    savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : Date.now()
  }
}

function loadWebStorePositions(): Record<string, ReaderPosition> {
  const raw = safeLocalStorageGet(READER_POSITION_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, ReaderPosition>
    return parsed ?? {}
  } catch {
    return {}
  }
}

async function readReaderCacheValue(key: string): Promise<unknown | null> {
  const database = await openReaderCacheDb()
  if (!database) {
    return null
  }

  try {
    return await new Promise<unknown | null>((resolve) => {
      const transaction = database.transaction(READER_CACHE_STORE_NAME, 'readonly')
      const store = transaction.objectStore(READER_CACHE_STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result ?? null)
      }

      request.onerror = () => {
        resolve(null)
      }
    })
  } finally {
    database.close()
  }
}

async function writeReaderCacheValue(key: string, value: unknown): Promise<void> {
  const database = await openReaderCacheDb()
  if (!database) {
    return
  }

  try {
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(READER_CACHE_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(READER_CACHE_STORE_NAME)
      store.put(value, key)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    })
  } finally {
    database.close()
  }
}

function openReaderCacheDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    const request = indexedDB.open(READER_CACHE_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(READER_CACHE_STORE_NAME)) {
        database.createObjectStore(READER_CACHE_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage quota and environment exceptions to keep reader usable.
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage exceptions.
  }
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (!event.ctrlKey) {
    return
  }

  if (isEditableTarget(event.target)) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    void goToPreviousChapter()
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    void goToNextChapter()
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
}

function normalizeReaderPreference(preference: Partial<ReaderPreference>): ReaderPreference {
  const mergedPreference = {
    ...DEFAULT_READER_PREFERENCE,
    ...preference
  } as ReaderPreference

  if (!isReaderThemeKey(mergedPreference.themeKey)) {
    mergedPreference.themeKey = DEFAULT_READER_PREFERENCE.themeKey
  }

  return mergedPreference
}

function isReaderThemeKey(value: string): value is ReaderThemeKey {
  return READER_THEME_OPTIONS.some((theme) => theme.key === value)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
</script>

<template>
  <div class="md-reader-app-root" :class="{ 'md-reader-app-root-compact-reading': mdReaderCompactReadingMode }">
    <header class="md-reader-header-section">
      <h1 class="md-reader-header-title">纪 Reader</h1>
      <p v-if="mdReaderShowsConfigPanel || !mdReaderHasLoadedDocument" class="md-reader-header-description">
        可按标题分章阅读，支持记录阅读进度与样式偏好。
      </p>

      <details v-if="mdReaderShowsConfigPanel" class="md-reader-header-panel-details" open>
        <summary class="md-reader-header-panel-summary">文件与阅读控制</summary>

        <section class="md-reader-header-panel-content-section" aria-label="文件加载与状态">
          <form class="md-reader-open-form" @submit.prevent="openMarkdownByPath" aria-label="打开 Markdown 文件">
            <template v-if="mdReaderSupportsPathOpen">
              <label class="md-reader-open-form-label" for="md-reader-open-form-path-input">Markdown 路径</label>
              <input
                id="md-reader-open-form-path-input"
                v-model="mdReaderPathInputModel"
                class="md-reader-open-form-path-input"
                type="text"
                autocomplete="off"
                placeholder="请输入 .md 文件路径"
              />
            </template>
            <div class="md-reader-open-form-button-group">
              <button v-if="mdReaderSupportsPathOpen" type="submit" class="md-reader-open-form-submit-button" :disabled="mdReaderIsLoading">
                按路径打开
              </button>
              <button type="button" class="md-reader-open-form-dialog-button" :disabled="mdReaderIsLoading" @click="openMarkdownByDialog">
                {{ mdReaderSupportsPathOpen ? '选择文件' : '选择 Markdown 文件' }}
              </button>
            </div>
            <input
              ref="mdReaderWebFileInputRef"
              class="md-reader-web-file-input"
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              @change="handleWebFileInputChange"
            />
          </form>
        </section>
      </details>

      <p class="md-reader-open-status-text" role="status">{{ mdReaderStatusText }}</p>
    </header>

    <div class="md-reader-workspace-shell" :class="{ 'md-reader-workspace-shell-reading-only': mdReaderCompactReadingMode }">
      <aside v-if="mdReaderShowsConfigPanel" class="md-reader-workspace-sidebar">
        <details class="md-reader-sidebar-panel-details" open>
          <summary class="md-reader-sidebar-panel-summary">目录</summary>
          <section class="md-reader-sidebar-panel-content-section" aria-label="目录面板">
            <ChapterList :chapters="mdReaderChapterItems" :active-index="mdReaderActiveChapterIndex" @select="handleChapterSwitch" />
          </section>
        </details>

        <details class="md-reader-sidebar-panel-details" open>
          <summary class="md-reader-sidebar-panel-summary">阅读样式</summary>
          <section class="md-reader-sidebar-panel-content-section" aria-label="阅读样式面板">
            <ReaderSettings :preference="mdReaderPreference" :themes="READER_THEME_OPTIONS" @change="handlePreferenceChange" />
          </section>
        </details>
      </aside>

      <main class="md-reader-workspace-main" aria-label="阅读区域">
        <section class="md-reader-workspace-article-section">
          <ReaderArticle
            :chapter="mdReaderCurrentChapter"
            :preference="mdReaderPreference"
            :initial-scroll-top="mdReaderRestoredScrollTop"
            @scroll-change="handleReaderScrollChange"
          />
        </section>

        <footer class="md-reader-workspace-navigation-footer">
          <nav class="md-reader-workspace-navigation-nav" aria-label="章节切换">
            <button type="button" class="md-reader-workspace-navigation-button" :disabled="!mdReaderHasPreviousChapter" @click="goToPreviousChapter">
              {{ mdReaderPrevButtonText }}
            </button>
            <p class="md-reader-workspace-navigation-progress">{{ mdReaderChapterProgressText }}</p>
            <button type="button" class="md-reader-workspace-navigation-button" :disabled="!mdReaderHasNextChapter" @click="goToNextChapter">
              {{ mdReaderNextButtonText }}
            </button>
          </nav>
        </footer>
      </main>
    </div>

    <button
      v-if="mdReaderShowFloatingConfigButton"
      type="button"
      class="md-reader-floating-config-button"
      @click="toggleReaderConfig"
    >
      {{ mdReaderFloatingConfigButtonText }}
    </button>
  </div>
</template>

<style lang="less" scoped>
:global(html),
:global(body),
:global(#app) {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.md-reader-app-root {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 18px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  overflow: hidden;
  background:
    radial-gradient(circle at 15% 10%, #f4ead5 0%, transparent 42%),
    linear-gradient(180deg, #f2ede2 0%, #ebe6db 100%);
  color: #1f1f1f;
  font-family: 'Source Han Serif SC', 'PingFang SC', serif;
}

.md-reader-app-root-compact-reading {
  padding: 10px;
  gap: 10px;
}

.md-reader-app-root-compact-reading .md-reader-header-section {
  display: none;
}

.md-reader-header-section {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #d8cfbb;
  background: rgba(255, 255, 255, 0.72);
}

.md-reader-header-title {
  margin-top: 0;
  margin-bottom: 8px;
}

.md-reader-header-description {
  margin-top: 0;
  margin-bottom: 14px;
}

.md-reader-header-panel-details {
  border: 1px solid #d8cfbb;
  border-radius: 10px;
  background: #fffdf8;
}

.md-reader-header-panel-summary {
  cursor: pointer;
  font-weight: 700;
  padding: 10px 12px;
  user-select: none;
}

.md-reader-header-panel-content-section {
  padding: 4px 12px 12px;
}

.md-reader-open-form {
  display: grid;
  gap: 8px;
}

.md-reader-open-form-label {
  font-weight: 600;
}

.md-reader-open-form-path-input {
  width: 100%;
  min-height: 38px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid #ccbea0;
  border-radius: 8px;
}

.md-reader-open-form-button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.md-reader-web-file-input {
  display: none;
}

.md-reader-open-form-submit-button,
.md-reader-open-form-dialog-button,
.md-reader-workspace-navigation-button,
.md-reader-floating-config-button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #7f755a;
  border-radius: 8px;
  background: #fffdf8;
  color: #1a1a1a;
  cursor: pointer;
}

.md-reader-open-form-submit-button:disabled,
.md-reader-open-form-dialog-button:disabled,
.md-reader-workspace-navigation-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.md-reader-open-status-text {
  margin-top: 10px;
  margin-bottom: 0;
  font-size: 13px;
}

.md-reader-workspace-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
  height: 100%;
  min-height: 0;
}

.md-reader-workspace-sidebar {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.md-reader-sidebar-panel-details {
  border: 1px solid #d5cfbf;
  border-radius: 10px;
  background: #fffaf0;
}

.md-reader-sidebar-panel-summary {
  cursor: pointer;
  user-select: none;
  font-weight: 700;
  padding: 10px 12px;
}

.md-reader-sidebar-panel-content-section {
  padding: 6px 12px 12px;
}

.md-reader-workspace-main {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
}

.md-reader-workspace-article-section {
  min-height: 0;
}

.md-reader-workspace-navigation-footer {
  border: 1px solid #d5cfbf;
  border-radius: 10px;
  background: #fffaf0;
  padding: 10px;
}

.md-reader-workspace-navigation-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.md-reader-workspace-navigation-progress {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.md-reader-floating-config-button {
  position: fixed;
  right: 16px;
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  z-index: 20;
  background: #f8f2e1;
  box-shadow: 0 4px 14px rgba(47, 39, 22, 0.2);
}

@media (max-width: 900px) {
  .md-reader-app-root {
    padding: 10px;
    gap: 10px;
  }

  .md-reader-header-section {
    padding: 12px;
  }

  .md-reader-workspace-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
  }

  .md-reader-workspace-shell-reading-only {
    grid-template-rows: minmax(0, 1fr);
  }

  .md-reader-workspace-sidebar {
    max-height: 44vh;
    padding-right: 0;
  }

  .md-reader-workspace-main {
    min-height: 0;
  }

  .md-reader-workspace-navigation-nav {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
  }

  .md-reader-workspace-navigation-button {
    width: 100%;
  }

  .md-reader-workspace-navigation-progress {
    text-align: center;
  }
}
</style>
