<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

import { fixChapterOrder, parseMarkdownDocument } from '@shared/markdown-parser'
import { DEFAULT_READER_PREFERENCE } from '@shared/reader-defaults'
import { normalizeRecentFiles, stripRecentFileContent, upsertRecentFile } from '@shared/recent-files'
import { READER_THEME_OPTIONS } from '@shared/reader-themes'
import {
  applyReplacementRules,
  normalizeReplacementRules,
  parseReplacementRulesText,
  serializeReplacementRules,
  type ReplacementRule
} from '@shared/replacement-rules'
import type {
  ParsedDocument,
  ReaderLastOpenedSession,
  ReaderPosition,
  ReaderPreference,
  ReaderRecentFile,
  ReaderSessionTab,
  ReaderThemeKey,
  FixResult
} from '@shared/reader-types'

import ChapterList from './components/ChapterList.vue'
import ReaderHiddenNavigation from './components/ReaderHiddenNavigation.vue'
import ReaderArticle from './components/ReaderArticle.vue'
import ReaderNavigationControls from './components/ReaderNavigationControls.vue'
import ReaderSettings from './components/ReaderSettings.vue'
import SearchPanel from './components/SearchPanel.vue'
import type { OpenTabInfo, SearchNavigatePayload } from './components/SearchPanel.vue'
import { findChapterIndexAtLine } from '@shared/text-search'
import { getCompactReaderControlsState, type CompactReaderPanel } from './reader-controls-state'
import { getVolumePageDirection } from './reader-keyboard'

const sampleFilePath =
  '/Users/hunter/Downloads/toutiao/books/倚天：重生张无忌，多情公子-7379149479284329496.decoded.md'

const READER_PREFERENCE_STORAGE_KEY = 'md-reader-preference-v1'
const READER_POSITION_STORAGE_KEY = 'md-reader-position-v1'
const READER_LAST_OPENED_STORAGE_KEY = 'md-reader-last-opened-v1'
const READER_RECENT_FILES_STORAGE_KEY = 'md-reader-recent-files-v1'
const READER_LAST_BOOK_TEXT_STORAGE_KEY = 'md-reader-last-book-text-v1'
const READER_REPLACEMENT_RULES_STORAGE_KEY = 'md-reader-replacement-rules-v1'
const READER_REPLACEMENT_RULE_TEXTS_STORAGE_KEY = 'md-reader-replacement-rule-texts-v1'

const READER_CACHE_DB_NAME = 'md-reader-cache-db'
const READER_CACHE_STORE_NAME = 'reader-cache-store'
const READER_CACHE_LAST_BOOK_KEY = 'last-book-v1'
const MOBILE_READER_STORE_PATH = 'MarkdownReader/reader-store-v1.json'
const MOBILE_READER_STORE_MAX_BYTES = 2 * 1024 * 1024

const COMPACT_LAYOUT_MEDIA_QUERY = '(max-width: 900px)'

interface ReaderCachedBookSnapshot {
  sourceKey: string
  sourceLabel: string
  markdownText: string
  savedAt: number
}

interface MobileReaderStoreData {
  positions: Record<string, ReaderPosition>
  preference: ReaderPreference | null
  replacementRules: Record<string, ReplacementRule[]>
  replacementRuleTexts: Record<string, string>
  lastOpenedSession: ReaderLastOpenedSession | null
  lastBookSnapshot: ReaderCachedBookSnapshot | null
  recentFiles: ReaderRecentFile[]
}

interface ReaderOpenTab extends ReaderSessionTab {
  markdownText: string
  savedMarkdownText: string
  isDirty: boolean
}

interface ReaderScrollState {
  scrollTop: number
  canScrollPrevious: boolean
  canScrollNext: boolean
}

const mdReaderPathInputModel = ref(sampleFilePath)
const mdReaderTabs = ref<ReaderOpenTab[]>([])
const mdReaderRecentFiles = ref<ReaderRecentFile[]>([])
const mdReaderActiveTabId = ref('')
const mdReaderCurrentSourceKey = ref('')
const mdReaderParsedDocument = ref<ParsedDocument | null>(null)
const mdReaderRawMarkdown = ref('')
const mdReaderReplacementRules = ref<ReplacementRule[]>([])
const mdReaderReplacementRulesText = ref('')
const mdReaderActiveChapterIndex = ref(0)
const mdReaderRestoredScrollTop = ref(0)
const mdReaderLatestScrollTop = ref(0)
const mdReaderPreference = ref<ReaderPreference>({ ...DEFAULT_READER_PREFERENCE })
const mdReaderStatusText = ref('请选择 Markdown 文件，或在桌面端输入路径打开。')
const mdReaderIsLoading = ref(false)
const mdReaderIsCompactLayout = ref(false)
const mdReaderCompactPanel = ref<CompactReaderPanel>(null)
const mdReaderReadingControlsVisible = ref(true)
const mdReaderWebFileInputRef = ref<HTMLInputElement | null>(null)
const mdReaderSearchPanelVisible = ref(false)
const mdReaderSearchPanelRef = ref<InstanceType<typeof SearchPanel> | null>(null)
const mdReaderArticleRef = ref<InstanceType<typeof ReaderArticle> | null>(null)
const mdReaderSupportsPathOpen = computed(() => Boolean(window.electronAPI))

const mdReaderChapterItems = computed(() => mdReaderParsedDocument.value?.chapters ?? [])
const mdReaderCurrentChapter = computed(() => mdReaderChapterItems.value[mdReaderActiveChapterIndex.value] ?? null)
const mdReaderHasPreviousChapter = computed(() => mdReaderActiveChapterIndex.value > 0)
const mdReaderHasNextChapter = computed(
  () => mdReaderActiveChapterIndex.value < mdReaderChapterItems.value.length - 1
)
const mdReaderCanScrollPrevious = ref(false)
const mdReaderCanScrollNext = ref(false)
const mdReaderHasLoadedDocument = computed(() => mdReaderParsedDocument.value !== null)
const mdReaderCompactControlsState = computed(() =>
  getCompactReaderControlsState({
    compactLayout: mdReaderIsCompactLayout.value,
    hasDocument: mdReaderHasLoadedDocument.value,
    activePanel: mdReaderCompactPanel.value,
    controlsVisible: mdReaderReadingControlsVisible.value
  })
)
const mdReaderIsCompactLoadedMode = computed(() => mdReaderCompactControlsState.value.isCompactLoadedMode)
const mdReaderCurrentChapterTitle = computed(() => {
  const title = mdReaderCurrentChapter.value?.title?.trim()
  return title ? applyReplacementRules(title, mdReaderReplacementRules.value) : '未选择章节'
})
const mdReaderCompactReadingMode = computed(() => mdReaderCompactControlsState.value.isCompactReadingMode)
const mdReaderShowsConfigPanel = computed(() => mdReaderCompactControlsState.value.showsConfigPanel)
const mdReaderShowChapterPanel = computed(() => mdReaderCompactControlsState.value.showChapterPanel)
const mdReaderShowSettingsPanel = computed(() => mdReaderCompactControlsState.value.showSettingsPanel)
const mdReaderShowTopbar = computed(() => mdReaderCompactControlsState.value.showTopbar)
const mdReaderActiveTab = computed(() => mdReaderTabs.value.find((tab) => tab.id === mdReaderActiveTabId.value) ?? null)
const mdReaderHasOpenTabs = computed(() => mdReaderTabs.value.length > 0)
const mdReaderUnsavedTabCount = computed(() => mdReaderTabs.value.filter((tab) => tab.isDirty).length)
const mdReaderCanSaveCurrentTab = computed(() => {
  const activeTab = mdReaderActiveTab.value
  return Boolean(mdReaderSupportsPathOpen.value && activeTab?.sourceType === 'path' && activeTab.filePath && activeTab.isDirty)
})
const mdReaderChapterProgressText = computed(() => {
  if (mdReaderChapterItems.value.length === 0) {
    return '未加载章节'
  }

  return `第 ${mdReaderActiveChapterIndex.value + 1} / ${mdReaderChapterItems.value.length} 章`
})
const mdReaderShowReadingControls = computed(() => mdReaderCompactControlsState.value.showReadingControls)
const mdReaderShowReadingControlsReveal = computed(() => mdReaderCompactControlsState.value.showRevealButton)
const mdReaderShowHiddenNavigation = computed(() => mdReaderCompactControlsState.value.showHiddenNavigation)

const mdReaderSearchOpenTabs = computed((): OpenTabInfo[] =>
  mdReaderTabs.value.map((tab) => ({
    id: tab.id,
    sourceKey: tab.sourceKey,
    sourceLabel: tab.sourceLabel,
    filePath: tab.filePath,
    markdownText: tab.markdownText
  }))
)

const mdReaderActiveTabFilePath = computed(() => mdReaderActiveTab.value?.filePath)

watch(
  mdReaderCompactReadingMode,
  (isReadingMode) => {
    window.markdownReaderAndroid?.setReadingMode(isReadingMode)
  },
  { immediate: true }
)

let savePositionTimer: number | null = null
let compactLayoutMediaQuery: MediaQueryList | null = null
let mobileReaderStoreCache: MobileReaderStoreData | null = null
let mobileReaderBookSnapshotCache: ReaderCachedBookSnapshot | null = null
let recentFilesLoadPromise: Promise<void> | null = null
let draggedTabId = ''

onMounted(() => {
  setupCompactLayoutWatcher()
  writeReaderDebugLog('mounted', {
    supportsPathOpen: mdReaderSupportsPathOpen.value,
    initialTabsCount: mdReaderTabs.value.length
  })
  void loadPreference()
  recentFilesLoadPromise = loadRecentFiles()
  void recentFilesLoadPromise
  void restoreLastReadingSession()
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  teardownCompactLayoutWatcher()

  if (savePositionTimer !== null) {
    window.clearTimeout(savePositionTimer)
    savePositionTimer = null
  }

  void persistReaderPosition(mdReaderLatestScrollTop.value)
  updateActiveTabFromCurrentDocument()
  void saveCurrentTabSession('before-unmount')
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
    mdReaderCompactPanel.value = null
  }
}

function closeCompactPanel(): void {
  mdReaderCompactPanel.value = null
}

function toggleCompactPanel(panel: Exclude<CompactReaderPanel, null>): void {
  if (!mdReaderIsCompactLoadedMode.value) {
    return
  }

  mdReaderCompactPanel.value = mdReaderCompactPanel.value === panel ? null : panel
}

function canUseMobileFilesystemStore(): boolean {
  return !mdReaderSupportsPathOpen.value && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
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
    const existingTab = mdReaderTabs.value.find((tab) => tab.sourceType === 'path' && tab.filePath === filePath)
    if (existingTab) {
      await activateReaderTab(existingTab.id)
      return
    }

    const markdownText = await window.electronAPI.readMarkdownFile(filePath)
    await openMarkdownContentTab({
      sourceType: 'path',
      sourceKey: filePath,
      sourceLabel: filePath,
      filePath,
      markdownText,
      savedMarkdownText: markdownText
    })
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
    await openMarkdownContentTab({
      sourceType: 'cachedText',
      sourceKey,
      sourceLabel: file.name,
      markdownText,
      savedMarkdownText: markdownText
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    mdReaderStatusText.value = `加载失败：${message}`
  } finally {
    input.value = ''
  }
}

async function openMarkdownContentTab(input: {
  sourceType: ReaderOpenTab['sourceType']
  sourceKey: string
  sourceLabel: string
  filePath?: string
  markdownText: string
  savedMarkdownText: string
}): Promise<void> {
  const existingTab = mdReaderTabs.value.find((tab) => tab.sourceKey === input.sourceKey)
  if (existingTab) {
    await touchRecentFile(existingTab)
    writeReaderDebugLog('tab:open-existing', {
      requested: summarizeTabInput(input),
      existingTabId: existingTab.id
    })
    await activateReaderTab(existingTab.id)
    return
  }

  writeReaderDebugLog('tab:open-new:start', summarizeTabInput(input))
  updateActiveTabFromCurrentDocument()
  await persistReaderPosition(mdReaderLatestScrollTop.value)

  const tab: ReaderOpenTab = {
    id: createReaderTabId(input.sourceKey),
    sourceType: input.sourceType,
    sourceKey: input.sourceKey,
    sourceLabel: input.sourceLabel,
    filePath: input.filePath,
    markdownText: input.markdownText,
    savedMarkdownText: input.savedMarkdownText,
    isDirty: input.markdownText !== input.savedMarkdownText
  }

  mdReaderTabs.value.push(tab)
  await touchRecentFile(tab)
  writeReaderDebugLog('tab:open-new:pushed', {
    tab: summarizeTab(tab),
    tabs: summarizeOpenTabs()
  })
  await saveCurrentTabSession('open-new-tab')
  await activateReaderTab(tab.id)
}

async function openRecentFile(file: ReaderRecentFile): Promise<void> {
  if (file.sourceType === 'path' && file.filePath && mdReaderSupportsPathOpen.value) {
    await loadMarkdownFile(file.filePath)
    return
  }

  if (file.sourceType === 'cachedText') {
    const snapshot = typeof file.markdownText === 'string' ? {
      sourceKey: file.sourceKey,
      sourceLabel: file.sourceLabel,
      markdownText: file.markdownText,
      savedAt: file.lastOpenedAt
    } : await loadLastBookSnapshot()

    if (!snapshot || snapshot.sourceKey !== file.sourceKey) {
      mdReaderStatusText.value = `无法打开最近文件：${displayRecentFileLabel(file)}`
      return
    }

    await openMarkdownContentTab({
      sourceType: 'cachedText',
      sourceKey: file.sourceKey,
      sourceLabel: file.sourceLabel,
      markdownText: snapshot.markdownText,
      savedMarkdownText: snapshot.markdownText
    })
    return
  }

  mdReaderStatusText.value = `无法打开最近文件：${displayRecentFileLabel(file)}`
}

async function activateReaderTab(tabId: string): Promise<void> {
  if (tabId === mdReaderActiveTabId.value && mdReaderParsedDocument.value) {
    writeReaderDebugLog('tab:activate:skip-current', {
      tabId,
      tabs: summarizeOpenTabs()
    })
    return
  }

  writeReaderDebugLog('tab:activate:start', {
    requestedTabId: tabId,
    previousActiveTabId: mdReaderActiveTabId.value,
    tabs: summarizeOpenTabs()
  })
  updateActiveTabFromCurrentDocument()
  await persistReaderPosition(mdReaderLatestScrollTop.value)

  const tab = mdReaderTabs.value.find((item) => item.id === tabId)
  if (!tab) {
    writeReaderDebugLog('tab:activate:missing', {
      requestedTabId: tabId,
      tabs: summarizeOpenTabs()
    })
    return
  }

  await loadMarkdownContent(tab.sourceKey, tab.sourceLabel, tab.markdownText, tab.id)
  await saveCurrentTabSession('activate-tab')
}

async function loadMarkdownContent(sourceKey: string, sourceLabel: string, markdownText: string, tabId: string): Promise<void> {
  mdReaderIsLoading.value = true

  try {
    mdReaderRawMarkdown.value = markdownText
    mdReaderCurrentSourceKey.value = sourceKey
    mdReaderReplacementRulesText.value = await loadReaderReplacementRulesText(sourceKey)
    mdReaderReplacementRules.value = parseReplacementRulesText(mdReaderReplacementRulesText.value).rules
    const parsed = parseMarkdownDocument(markdownText, sourceLabel)

    mdReaderParsedDocument.value = parsed
    mdReaderActiveTabId.value = tabId

    const savedPosition = await loadReaderPosition(sourceKey)
    const chapterLength = parsed.chapters.length
    const safeChapterIndex = clampNumber(savedPosition?.chapterIndex ?? 0, 0, Math.max(chapterLength - 1, 0))

    mdReaderActiveChapterIndex.value = safeChapterIndex
    mdReaderRestoredScrollTop.value = Math.max(savedPosition?.scrollTop ?? 0, 0)
    mdReaderLatestScrollTop.value = mdReaderRestoredScrollTop.value

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
      closeCompactPanel()
    }
  } finally {
    mdReaderIsLoading.value = false
  }
}

async function fixChapterOrderAndReload(): Promise<void> {
  if (!mdReaderRawMarkdown.value) {
    mdReaderStatusText.value = '请先加载一个 Markdown 文件'
    return
  }

  mdReaderIsLoading.value = true
  mdReaderStatusText.value = '正在修复章节顺序...'

  try {
    const result: FixResult = fixChapterOrder(mdReaderRawMarkdown.value)

    if (result.report.isOrdered) {
      mdReaderStatusText.value = `章节顺序正确，无需修复（${result.report.totalChapters} 章）`
      return
    }

    mdReaderRawMarkdown.value = result.fixedMarkdown
    updateActiveTabFromCurrentDocument()
    if (mdReaderActiveTabId.value && mdReaderCurrentSourceKey.value) {
      const activeTab = mdReaderActiveTab.value
      await loadMarkdownContent(
        mdReaderCurrentSourceKey.value,
        activeTab?.sourceLabel ?? mdReaderParsedDocument.value?.documentTitle ?? '修复后文档',
        result.fixedMarkdown,
        mdReaderActiveTabId.value
      )
    }
    await saveCurrentTabSession('fix-chapter-order')

    mdReaderStatusText.value = `已修复：重排 ${result.report.fixedCount} 章，共 ${result.report.totalChapters} 章，请保存当前标签页。`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    mdReaderStatusText.value = `修复失败：${message}`
  } finally {
    mdReaderIsLoading.value = false
  }
}

async function saveCurrentMarkdownTab(): Promise<void> {
  updateActiveTabFromCurrentDocument()

  const activeTab = mdReaderActiveTab.value
  if (!activeTab || activeTab.sourceType !== 'path' || !activeTab.filePath) {
    mdReaderStatusText.value = '当前标签页不支持保存到路径。'
    return
  }

  try {
    await window.electronAPI.writeMarkdownFile(activeTab.filePath, activeTab.markdownText)
    activeTab.savedMarkdownText = activeTab.markdownText
    activeTab.isDirty = false
    mdReaderStatusText.value = `已保存：${displayTabLabel(activeTab)}`
    await saveCurrentTabSession('save-current-markdown-tab')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    mdReaderStatusText.value = `保存失败：${message}`
  }
}

async function closeReaderTab(tabId: string): Promise<void> {
  updateActiveTabFromCurrentDocument()

  const tabIndex = mdReaderTabs.value.findIndex((tab) => tab.id === tabId)
  if (tabIndex < 0) {
    writeReaderDebugLog('tab:close:missing', {
      requestedTabId: tabId,
      tabs: summarizeOpenTabs()
    })
    return
  }

  const tab = mdReaderTabs.value[tabIndex]
  if (tab.isDirty && !window.confirm(`“${displayTabLabel(tab)}”有未保存改动，关闭后会丢失。确定关闭吗？`)) {
    writeReaderDebugLog('tab:close:cancelled-dirty', {
      tab: summarizeTab(tab),
      tabs: summarizeOpenTabs()
    })
    return
  }

  writeReaderDebugLog('tab:close:start', {
    tab: summarizeTab(tab),
    tabIndex,
    tabsBefore: summarizeOpenTabs()
  })
  const wasActive = tab.id === mdReaderActiveTabId.value
  mdReaderTabs.value.splice(tabIndex, 1)

  if (mdReaderTabs.value.length === 0) {
    clearCurrentReaderDocument()
    writeReaderDebugLog('tab:close:last-tab', {
      closedTabId: tab.id
    })
    await saveLastOpenedSession(null)
    return
  }

  await saveCurrentTabSession('close-tab')

  if (wasActive) {
    const nextTab = mdReaderTabs.value[Math.min(tabIndex, mdReaderTabs.value.length - 1)]
    await activateReaderTab(nextTab.id)
    return
  }
}

function handleTabDragStart(tabId: string, event: DragEvent): void {
  draggedTabId = tabId
  event.dataTransfer?.setData('text/plain', tabId)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleTabDrop(targetTabId: string): void {
  const sourceTabId = draggedTabId
  draggedTabId = ''

  if (!sourceTabId || sourceTabId === targetTabId) {
    writeReaderDebugLog('tab:reorder:skip', {
      sourceTabId,
      targetTabId,
      tabs: summarizeOpenTabs()
    })
    return
  }

  const sourceIndex = mdReaderTabs.value.findIndex((tab) => tab.id === sourceTabId)
  const targetIndex = mdReaderTabs.value.findIndex((tab) => tab.id === targetTabId)
  if (sourceIndex < 0 || targetIndex < 0) {
    writeReaderDebugLog('tab:reorder:missing', {
      sourceTabId,
      targetTabId,
      sourceIndex,
      targetIndex,
      tabs: summarizeOpenTabs()
    })
    return
  }

  writeReaderDebugLog('tab:reorder:start', {
    sourceTabId,
    targetTabId,
    sourceIndex,
    targetIndex,
    tabsBefore: summarizeOpenTabs()
  })
  const [sourceTab] = mdReaderTabs.value.splice(sourceIndex, 1)
  mdReaderTabs.value.splice(targetIndex, 0, sourceTab)
  void saveCurrentTabSession('reorder-tabs')
}

function handleTabDragEnd(): void {
  draggedTabId = ''
}

function buildLastOpenedSessionFromTabs(): ReaderLastOpenedSession | null {
  updateActiveTabFromCurrentDocument()

  const tabs = mdReaderTabs.value.map((tab): ReaderSessionTab => ({
    id: tab.id,
    sourceType: tab.sourceType,
    sourceKey: tab.sourceKey,
    sourceLabel: tab.sourceLabel,
    filePath: tab.filePath
  }))

  const activeTab = mdReaderActiveTab.value ?? mdReaderTabs.value[0]
  if (!activeTab) {
    return null
  }

  return {
    sourceType: activeTab.sourceType,
    sourceKey: activeTab.sourceKey,
    sourceLabel: activeTab.sourceLabel,
    filePath: activeTab.filePath,
    tabs,
    activeTabId: activeTab.id
  }
}

async function saveCurrentTabSession(reason = 'unspecified'): Promise<void> {
  const session = buildLastOpenedSessionFromTabs()
  writeReaderDebugLog('session:save:start', {
    reason,
    session: summarizeSession(session),
    tabs: summarizeOpenTabs()
  })
  await saveLastOpenedSession(session)
  writeReaderDebugLog('session:save:complete', {
    reason,
    session: summarizeSession(session)
  })
}

async function restoreLastReadingSession(): Promise<void> {
  const lastOpened = await loadLastOpenedSession()
  writeReaderDebugLog('session:restore:loaded', summarizeSession(lastOpened))

  if (!lastOpened) {
    return
  }

  const sessionTabs = normalizeSessionTabs(lastOpened)
  writeReaderDebugLog('session:restore:tabs-normalized', {
    tabsCount: sessionTabs.length,
    tabs: sessionTabs.map(summarizeTab)
  })
  const restoredTabs: ReaderOpenTab[] = []

  for (const tab of sessionTabs) {
    const restoredTab = await restoreSavedTab(tab)
    if (restoredTab) {
      restoredTabs.push(restoredTab)
      writeReaderDebugLog('session:restore:tab-success', summarizeTab(restoredTab))
    } else {
      writeReaderDebugLog('session:restore:tab-failed', summarizeTab(tab))
    }
  }

  if (restoredTabs.length === 0) {
    writeReaderDebugLog('session:restore:no-tabs-restored', {
      requestedTabsCount: sessionTabs.length
    })
    return
  }

  mdReaderTabs.value = restoredTabs
  const activeTabId =
    lastOpened.activeTabId && restoredTabs.some((tab) => tab.id === lastOpened.activeTabId) ? lastOpened.activeTabId : restoredTabs[0].id
  writeReaderDebugLog('session:restore:activating', {
    activeTabId,
    restoredTabs: restoredTabs.map(summarizeTab)
  })
  await activateReaderTab(activeTabId)
  mdReaderStatusText.value = `已自动恢复 ${restoredTabs.length} 个标签页`
}

function normalizeSessionTabs(session: ReaderLastOpenedSession): ReaderSessionTab[] {
  if (session.tabs?.length) {
    return session.tabs
  }

  return [
    {
      id: createReaderTabId(session.sourceKey),
      sourceType: session.sourceType,
      sourceKey: session.sourceKey,
      sourceLabel: session.sourceLabel,
      filePath: session.filePath
    }
  ]
}

async function restoreSavedTab(tab: ReaderSessionTab): Promise<ReaderOpenTab | null> {
  if (tab.sourceType === 'path' && mdReaderSupportsPathOpen.value && tab.filePath) {
    try {
      const markdownText = await window.electronAPI.readMarkdownFile(tab.filePath)
      mdReaderPathInputModel.value = tab.filePath
      return {
        ...tab,
        markdownText,
        savedMarkdownText: markdownText,
        isDirty: false
      }
    } catch (error) {
      writeReaderDebugLog('session:restore:path-read-failed', {
        tab: summarizeTab(tab),
        message: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  if (tab.sourceType === 'cachedText' && !mdReaderSupportsPathOpen.value) {
    const snapshot = await loadLastBookSnapshot()
    if (!snapshot || snapshot.sourceKey !== tab.sourceKey) {
      writeReaderDebugLog('session:restore:cached-snapshot-mismatch', {
        tab: summarizeTab(tab),
        snapshotSourceKey: snapshot?.sourceKey ?? null
      })
      return null
    }

    return {
      ...tab,
      markdownText: snapshot.markdownText,
      savedMarkdownText: snapshot.markdownText,
      isDirty: false
    }
  }

  return null
}

function createReaderTabId(sourceKey: string): string {
  return `tab:${sourceKey}`
}

function displayTabLabel(tab: ReaderSessionTab): string {
  return displaySourceLabel(tab.sourceLabel || tab.filePath || tab.sourceKey)
}

function displayRecentFileLabel(file: ReaderRecentFile): string {
  return displaySourceLabel(file.sourceLabel || file.filePath || file.sourceKey)
}

function displaySourceLabel(label: string): string {
  const normalized = label.replace(/\\/g, '/')
  const lastSegment = normalized.split('/').filter(Boolean).at(-1)
  return lastSegment || label || '未命名'
}

function writeReaderDebugLog(event: string, payload?: Record<string, unknown>): void {
  if (!mdReaderSupportsPathOpen.value || typeof window.electronAPI.writeReaderDebugLog !== 'function') {
    return
  }

  void window.electronAPI.writeReaderDebugLog(event, {
    activeTabId: mdReaderActiveTabId.value,
    tabsCount: mdReaderTabs.value.length,
    payload: payload ?? null
  }).catch((error) => {
    console.warn('Failed to write reader debug log', error)
  })
}

function summarizeOpenTabs(): Array<Record<string, unknown>> {
  return mdReaderTabs.value.map(summarizeTab)
}

function summarizeTab(tab: ReaderSessionTab): Record<string, unknown> {
  return {
    id: tab.id,
    sourceType: tab.sourceType,
    sourceKey: tab.sourceKey,
    sourceLabel: tab.sourceLabel,
    filePath: tab.filePath ?? null
  }
}

function summarizeTabInput(input: {
  sourceType: ReaderOpenTab['sourceType']
  sourceKey: string
  sourceLabel: string
  filePath?: string
}): Record<string, unknown> {
  return {
    sourceType: input.sourceType,
    sourceKey: input.sourceKey,
    sourceLabel: input.sourceLabel,
    filePath: input.filePath ?? null
  }
}

function summarizeSession(session: ReaderLastOpenedSession | null): Record<string, unknown> {
  return {
    hasSession: Boolean(session),
    sourceType: session?.sourceType ?? null,
    sourceKey: session?.sourceKey ?? null,
    sourceLabel: session?.sourceLabel ?? null,
    filePath: session?.filePath ?? null,
    activeTabId: session?.activeTabId ?? null,
    tabsCount: session?.tabs?.length ?? 0,
    tabs: session?.tabs?.map(summarizeTab) ?? []
  }
}

function updateActiveTabFromCurrentDocument(nextSourceLabel?: string): void {
  const activeTab = mdReaderActiveTab.value
  if (!activeTab || !mdReaderCurrentSourceKey.value) {
    return
  }

  activeTab.markdownText = mdReaderRawMarkdown.value
  if (nextSourceLabel) {
    activeTab.sourceLabel = nextSourceLabel
  }
  activeTab.isDirty = activeTab.markdownText !== activeTab.savedMarkdownText
}

function clearCurrentReaderDocument(): void {
  mdReaderActiveTabId.value = ''
  mdReaderCurrentSourceKey.value = ''
  mdReaderParsedDocument.value = null
  mdReaderRawMarkdown.value = ''
  mdReaderReplacementRules.value = []
  mdReaderReplacementRulesText.value = ''
  mdReaderActiveChapterIndex.value = 0
  mdReaderCanScrollPrevious.value = false
  mdReaderCanScrollNext.value = false
  mdReaderRestoredScrollTop.value = 0
  mdReaderLatestScrollTop.value = 0
  mdReaderStatusText.value = '请选择 Markdown 文件，或在桌面端输入路径打开。'
}

function handleBeforeUnload(event: BeforeUnloadEvent): string | undefined {
  updateActiveTabFromCurrentDocument()
  const unsavedCount = mdReaderTabs.value.filter((tab) => tab.isDirty).length
  if (unsavedCount === 0) {
    void persistReaderPosition(mdReaderLatestScrollTop.value)
    void saveCurrentTabSession('beforeunload-clean')
    return undefined
  }

  const message = `有 ${unsavedCount} 个标签页存在未保存改动，确定关闭应用吗？`
  if (window.confirm(message)) {
    void persistReaderPosition(mdReaderLatestScrollTop.value)
    void saveCurrentTabSession('beforeunload-confirmed-dirty')
    return undefined
  }

  event.preventDefault()
  event.returnValue = message
  return message
}

async function handleChapterSwitch(index: number): Promise<void> {
  if (mdReaderChapterItems.value.length === 0) {
    return
  }

  const safeIndex = clampNumber(index, 0, mdReaderChapterItems.value.length - 1)
  mdReaderActiveChapterIndex.value = safeIndex
  mdReaderCanScrollPrevious.value = false
  mdReaderCanScrollNext.value = false
  mdReaderRestoredScrollTop.value = 0
  mdReaderLatestScrollTop.value = 0

  await persistReaderPosition(0)

  if (mdReaderIsCompactLayout.value) {
    closeCompactPanel()
  }
}

function goToPreviousPage(): void {
  mdReaderArticleRef.value?.scrollByPage(-1)
}

function goToNextPage(): void {
  mdReaderArticleRef.value?.scrollByPage(1)
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

function handleReaderScrollChange(state: ReaderScrollState): void {
  mdReaderLatestScrollTop.value = Math.max(state.scrollTop, 0)
  mdReaderCanScrollPrevious.value = state.canScrollPrevious
  mdReaderCanScrollNext.value = state.canScrollNext

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

function handleReplacementInput(value: string): void {
  mdReaderReplacementRulesText.value = value
  mdReaderReplacementRules.value = parseReplacementRulesText(value).rules
}

async function handleReplacementChange(value: string): Promise<void> {
  handleReplacementInput(value)
  if (!mdReaderCurrentSourceKey.value) {
    return
  }

  await saveReaderReplacementRulesText(mdReaderCurrentSourceKey.value, value)
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

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    return mobileStore.positions[sourceKey] ?? null
  }

  return loadWebStorePositions()[sourceKey] ?? null
}

async function saveReaderPosition(sourceKey: string, value: ReaderPosition): Promise<void> {
  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveReaderPosition(sourceKey, value)
    return
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mobileStore.positions[sourceKey] = value
    await saveMobileReaderStore(mobileStore)
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

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    return mobileStore.preference
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

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mobileStore.preference = value
    await saveMobileReaderStore(mobileStore)
    return
  }

  safeLocalStorageSet(READER_PREFERENCE_STORAGE_KEY, JSON.stringify(value))
}

async function loadReaderReplacementRules(sourceKey: string): Promise<ReplacementRule[]> {
  if (mdReaderSupportsPathOpen.value) {
    return window.electronAPI.loadReaderReplacementRules(sourceKey)
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    return mobileStore.replacementRules[sourceKey] ?? []
  }

  const raw = safeLocalStorageGet(READER_REPLACEMENT_RULES_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return normalizeReplacementRules(parsed[sourceKey])
  } catch {
    return []
  }
}

async function loadReaderReplacementRulesText(sourceKey: string): Promise<string> {
  if (mdReaderSupportsPathOpen.value) {
    const savedText = await window.electronAPI.loadReaderReplacementRulesText(sourceKey)
    if (savedText !== null) {
      return savedText
    }

    return serializeReplacementRules(await window.electronAPI.loadReaderReplacementRules(sourceKey))
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    if (Object.prototype.hasOwnProperty.call(mobileStore.replacementRuleTexts, sourceKey)) {
      return mobileStore.replacementRuleTexts[sourceKey]
    }

    return serializeReplacementRules(mobileStore.replacementRules[sourceKey] ?? [])
  }

  const rawTexts = safeLocalStorageGet(READER_REPLACEMENT_RULE_TEXTS_STORAGE_KEY)
  if (rawTexts) {
    try {
      const texts = JSON.parse(rawTexts) as Record<string, unknown>
      if (typeof texts[sourceKey] === 'string') {
        return texts[sourceKey]
      }
    } catch {
      // Fall through to the pre-text storage format.
    }
  }

  const rawRules = safeLocalStorageGet(READER_REPLACEMENT_RULES_STORAGE_KEY)
  if (!rawRules) {
    return ''
  }

  try {
    const rulesBySource = JSON.parse(rawRules) as Record<string, unknown>
    return serializeReplacementRules(normalizeReplacementRules(rulesBySource[sourceKey]))
  } catch {
    return ''
  }
}

async function saveReaderReplacementRules(sourceKey: string, value: ReplacementRule[]): Promise<void> {
  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveReaderReplacementRules(sourceKey, value)
    return
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mobileStore.replacementRules[sourceKey] = normalizeReplacementRules(value)
    await saveMobileReaderStore(mobileStore)
    return
  }

  const raw = safeLocalStorageGet(READER_REPLACEMENT_RULES_STORAGE_KEY)
  let rulesBySource: Record<string, ReplacementRule[]> = {}
  if (raw) {
    try {
      rulesBySource = JSON.parse(raw) as Record<string, ReplacementRule[]>
    } catch {
      rulesBySource = {}
    }
  }
  rulesBySource[sourceKey] = normalizeReplacementRules(value)
  safeLocalStorageSet(READER_REPLACEMENT_RULES_STORAGE_KEY, JSON.stringify(rulesBySource))
}

async function saveReaderReplacementRulesText(sourceKey: string, value: string): Promise<void> {
  const parsedRules = parseReplacementRulesText(value).rules

  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveReaderReplacementRulesText(sourceKey, value)
    await window.electronAPI.saveReaderReplacementRules(sourceKey, parsedRules)
    return
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mobileStore.replacementRuleTexts[sourceKey] = value
    mobileStore.replacementRules[sourceKey] = normalizeReplacementRules(parsedRules)
    await saveMobileReaderStore(mobileStore)
    return
  }

  const rawTexts = safeLocalStorageGet(READER_REPLACEMENT_RULE_TEXTS_STORAGE_KEY)
  let textsBySource: Record<string, string> = {}
  if (rawTexts) {
    try {
      textsBySource = JSON.parse(rawTexts) as Record<string, string>
    } catch {
      textsBySource = {}
    }
  }
  textsBySource[sourceKey] = value
  safeLocalStorageSet(READER_REPLACEMENT_RULE_TEXTS_STORAGE_KEY, JSON.stringify(textsBySource))

  const rawRules = safeLocalStorageGet(READER_REPLACEMENT_RULES_STORAGE_KEY)
  let rulesBySource: Record<string, ReplacementRule[]> = {}
  if (rawRules) {
    try {
      rulesBySource = JSON.parse(rawRules) as Record<string, ReplacementRule[]>
    } catch {
      rulesBySource = {}
    }
  }
  rulesBySource[sourceKey] = normalizeReplacementRules(parsedRules)
  safeLocalStorageSet(READER_REPLACEMENT_RULES_STORAGE_KEY, JSON.stringify(rulesBySource))
}

async function loadLastOpenedSession(): Promise<ReaderLastOpenedSession | null> {
  if (mdReaderSupportsPathOpen.value) {
    return window.electronAPI.loadLastOpenedSession()
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    return mobileStore.lastOpenedSession
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
  writeReaderDebugLog('session:persist:start', summarizeSession(value))
  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveLastOpenedSession(value)
    writeReaderDebugLog('session:persist:desktop-complete', summarizeSession(value))
    return
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mobileStore.lastOpenedSession = value
    await saveMobileReaderStore(mobileStore)
    writeReaderDebugLog('session:persist:mobile-complete', summarizeSession(value))
    return
  }

  if (!value) {
    safeLocalStorageRemove(READER_LAST_OPENED_STORAGE_KEY)
    writeReaderDebugLog('session:persist:web-cleared')
    return
  }

  safeLocalStorageSet(READER_LAST_OPENED_STORAGE_KEY, JSON.stringify(value))
  writeReaderDebugLog('session:persist:web-complete', summarizeSession(value))
}

async function loadRecentFiles(): Promise<void> {
  if (mdReaderSupportsPathOpen.value) {
    mdReaderRecentFiles.value = normalizeRecentFiles(await window.electronAPI.loadRecentFiles())
    return
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mdReaderRecentFiles.value = stripRecentFileContent(mobileStore.recentFiles)
    return
  }

  const raw = safeLocalStorageGet(READER_RECENT_FILES_STORAGE_KEY)
  if (!raw) {
    mdReaderRecentFiles.value = []
    return
  }

  try {
    mdReaderRecentFiles.value = normalizeRecentFiles(JSON.parse(raw))
  } catch {
    mdReaderRecentFiles.value = []
  }
}

async function saveRecentFiles(value: ReaderRecentFile[]): Promise<void> {
  const normalized = normalizeRecentFiles(value)
  const persisted = mdReaderSupportsPathOpen.value ? normalized : stripRecentFileContent(normalized)
  mdReaderRecentFiles.value = persisted

  if (mdReaderSupportsPathOpen.value) {
    await window.electronAPI.saveRecentFiles(normalized)
    return
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mobileStore.recentFiles = persisted
    await saveMobileReaderStore(mobileStore)
    return
  }

  safeLocalStorageSet(READER_RECENT_FILES_STORAGE_KEY, JSON.stringify(persisted))
}

async function touchRecentFile(file: ReaderOpenTab | ReaderSessionTab): Promise<void> {
  if (recentFilesLoadPromise) {
    await recentFilesLoadPromise
  }

  const recentFile: ReaderRecentFile = {
    sourceType: file.sourceType,
    sourceKey: file.sourceKey,
    sourceLabel: file.sourceLabel,
    ...(file.filePath ? { filePath: file.filePath } : {}),
    ...('markdownText' in file && typeof file.markdownText === 'string' ? { markdownText: file.markdownText } : {}),
    lastOpenedAt: Date.now()
  }
  await saveRecentFiles(upsertRecentFile(mdReaderRecentFiles.value, recentFile))
}

async function loadLastBookSnapshot(): Promise<ReaderCachedBookSnapshot | null> {
  if (canUseMobileFilesystemStore()) {
    if (mobileReaderBookSnapshotCache) {
      return mobileReaderBookSnapshotCache
    }

    const indexedValue = await readReaderCacheValue(READER_CACHE_LAST_BOOK_KEY)
    const normalizedIndexed = normalizeCachedBookSnapshot(indexedValue)
    if (normalizedIndexed) {
      mobileReaderBookSnapshotCache = normalizedIndexed
      return normalizedIndexed
    }

    const mobileStore = await loadMobileReaderStore()
    const legacySnapshot = mobileStore?.lastBookSnapshot ?? null
    if (mobileStore && legacySnapshot) {
      mobileReaderBookSnapshotCache = legacySnapshot
      await writeReaderCacheValue(READER_CACHE_LAST_BOOK_KEY, legacySnapshot)
      mobileStore.lastBookSnapshot = null
      await saveMobileReaderStore(mobileStore)
    }

    return mobileReaderBookSnapshotCache
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    return mobileStore.lastBookSnapshot
  }

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
  if (canUseMobileFilesystemStore()) {
    mobileReaderBookSnapshotCache = value
    await writeReaderCacheValue(READER_CACHE_LAST_BOOK_KEY, value)

    const mobileStore = await loadMobileReaderStore()
    if (mobileStore) {
      mobileStore.lastBookSnapshot = null
      await saveMobileReaderStore(mobileStore)
    }
    return
  }

  const mobileStore = await loadMobileReaderStore()
  if (mobileStore) {
    mobileStore.lastBookSnapshot = value
    await saveMobileReaderStore(mobileStore)
    return
  }

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

  const normalized: ReaderLastOpenedSession = {
    sourceType: candidate.sourceType,
    sourceKey: candidate.sourceKey,
    sourceLabel: candidate.sourceLabel
  }

  if (candidate.sourceType === 'path') {
    if (typeof candidate.filePath !== 'string' || candidate.filePath.length === 0) {
      return null
    }

    normalized.filePath = candidate.filePath
  }

  const tabs = Array.isArray(candidate.tabs) ? candidate.tabs.map(normalizeSessionTab).filter((tab): tab is ReaderSessionTab => tab !== null) : []
  if (tabs.length > 0) {
    normalized.tabs = tabs
  }

  if (typeof candidate.activeTabId === 'string' && candidate.activeTabId.length > 0) {
    normalized.activeTabId = candidate.activeTabId
  }

  return normalized
}

function normalizeSessionTab(raw: unknown): ReaderSessionTab | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Partial<ReaderSessionTab>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }

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
      id: candidate.id,
      sourceType: 'path',
      sourceKey: candidate.sourceKey,
      sourceLabel: candidate.sourceLabel,
      filePath: candidate.filePath
    }
  }

  return {
    id: candidate.id,
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

async function loadMobileReaderStore(): Promise<MobileReaderStoreData | null> {
  if (!canUseMobileFilesystemStore()) {
    return null
  }

  if (mobileReaderStoreCache) {
    return mobileReaderStoreCache
  }

  try {
    const fileInfo = await Filesystem.stat({
      path: MOBILE_READER_STORE_PATH,
      directory: Directory.Documents
    })
    const fileSize = Number(fileInfo.size)
    if (Number.isFinite(fileSize) && fileSize > MOBILE_READER_STORE_MAX_BYTES) {
      await Filesystem.rename({
        from: MOBILE_READER_STORE_PATH,
        to: `MarkdownReader/reader-store-v1.oversized-${Date.now()}.json`,
        directory: Directory.Documents,
        toDirectory: Directory.Documents
      })
      const emptyStore = createEmptyMobileReaderStore()
      mobileReaderStoreCache = emptyStore
      await saveMobileReaderStore(emptyStore)
      return emptyStore
    }

    const { data } = await Filesystem.readFile({
      path: MOBILE_READER_STORE_PATH,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    })

    const text = typeof data === 'string' ? data : await data.text()
    const normalized = normalizeMobileReaderStoreData(JSON.parse(text))
    if (normalized.lastBookSnapshot) {
      mobileReaderBookSnapshotCache = normalized.lastBookSnapshot
      await writeReaderCacheValue(READER_CACHE_LAST_BOOK_KEY, normalized.lastBookSnapshot)
      normalized.lastBookSnapshot = null
    }
    mobileReaderStoreCache = normalized
    return normalized
  } catch {
    const migrated = buildLegacyWebStoreSnapshot()
    mobileReaderStoreCache = migrated
    await saveMobileReaderStore(migrated)
    return migrated
  }
}

async function saveMobileReaderStore(value: MobileReaderStoreData): Promise<void> {
  if (!canUseMobileFilesystemStore()) {
    return
  }

  mobileReaderStoreCache = value
  const persistedValue: MobileReaderStoreData = {
    ...value,
    lastBookSnapshot: null,
    recentFiles: stripRecentFileContent(value.recentFiles)
  }

  try {
    await Filesystem.writeFile({
      path: MOBILE_READER_STORE_PATH,
      directory: Directory.Documents,
      data: JSON.stringify(persistedValue, null, 2),
      encoding: Encoding.UTF8,
      recursive: true
    })
  } catch {
    // Ignore write failures and keep in-memory/app storage behavior usable.
  }
}

function createEmptyMobileReaderStore(): MobileReaderStoreData {
  return {
    positions: {},
    preference: null,
    replacementRules: {},
    replacementRuleTexts: {},
    lastOpenedSession: null,
    lastBookSnapshot: null,
    recentFiles: []
  }
}

function normalizeMobileReaderStoreData(raw: unknown): MobileReaderStoreData {
  if (!raw || typeof raw !== 'object') {
    return {
      positions: {},
      preference: null,
      replacementRules: {},
      replacementRuleTexts: {},
      lastOpenedSession: null,
      lastBookSnapshot: null,
      recentFiles: []
    }
  }

  const candidate = raw as Partial<MobileReaderStoreData>
  const normalizedPositions: Record<string, ReaderPosition> = {}

  if (candidate.positions && typeof candidate.positions === 'object') {
    for (const [key, value] of Object.entries(candidate.positions as Record<string, unknown>)) {
      if (typeof key !== 'string' || !value || typeof value !== 'object') {
        continue
      }

      const record = value as Partial<ReaderPosition>
      const chapterIndex = typeof record.chapterIndex === 'number' ? Math.max(Math.floor(record.chapterIndex), 0) : 0
      const scrollTop = typeof record.scrollTop === 'number' ? Math.max(record.scrollTop, 0) : 0

      normalizedPositions[key] = {
        chapterIndex,
        scrollTop
      }
    }
  }

  const lastBookSnapshot = normalizeCachedBookSnapshot(candidate.lastBookSnapshot)
  const recentFiles = stripRecentFileContent(normalizeRecentFiles(candidate.recentFiles))

  return {
    positions: normalizedPositions,
    preference: normalizeReaderPreference(candidate.preference ?? {}),
    replacementRules: normalizeStoredMobileReplacementRules(candidate.replacementRules),
    replacementRuleTexts: normalizeStoredMobileReplacementRuleTexts(candidate.replacementRuleTexts),
    lastOpenedSession: normalizeLastOpenedSession(candidate.lastOpenedSession),
    lastBookSnapshot,
    recentFiles: recentFiles.length > 0 || !lastBookSnapshot ? recentFiles : [{
      sourceType: 'cachedText',
      sourceKey: lastBookSnapshot.sourceKey,
      sourceLabel: lastBookSnapshot.sourceLabel,
      lastOpenedAt: lastBookSnapshot.savedAt
    }]
  }
}

function buildLegacyWebStoreSnapshot(): MobileReaderStoreData {
  const positions = loadWebStorePositions()

  let preference: ReaderPreference | null = null
  const rawPreference = safeLocalStorageGet(READER_PREFERENCE_STORAGE_KEY)
  if (rawPreference) {
    try {
      preference = normalizeReaderPreference(JSON.parse(rawPreference) as Partial<ReaderPreference>)
    } catch {
      preference = null
    }
  }

  let lastOpenedSession: ReaderLastOpenedSession | null = null
  const rawLastOpened = safeLocalStorageGet(READER_LAST_OPENED_STORAGE_KEY)
  if (rawLastOpened) {
    try {
      lastOpenedSession = normalizeLastOpenedSession(JSON.parse(rawLastOpened))
    } catch {
      lastOpenedSession = null
    }
  }

  let lastBookSnapshot: ReaderCachedBookSnapshot | null = null
  const rawLastBook = safeLocalStorageGet(READER_LAST_BOOK_TEXT_STORAGE_KEY)
  if (rawLastBook) {
    try {
      lastBookSnapshot = normalizeCachedBookSnapshot(JSON.parse(rawLastBook))
    } catch {
      lastBookSnapshot = null
    }
  }

  let recentFiles: ReaderRecentFile[] = []
  const rawRecentFiles = safeLocalStorageGet(READER_RECENT_FILES_STORAGE_KEY)
  if (rawRecentFiles) {
    try {
      recentFiles = normalizeRecentFiles(JSON.parse(rawRecentFiles))
    } catch {
      recentFiles = []
    }
  }

  if (recentFiles.length === 0 && lastBookSnapshot) {
    recentFiles = [{
      sourceType: 'cachedText',
      sourceKey: lastBookSnapshot.sourceKey,
      sourceLabel: lastBookSnapshot.sourceLabel,
      lastOpenedAt: lastBookSnapshot.savedAt
    }]
  }

  let replacementRules: Record<string, ReplacementRule[]> = {}
  const rawReplacementRules = safeLocalStorageGet(READER_REPLACEMENT_RULES_STORAGE_KEY)
  if (rawReplacementRules) {
    try {
      replacementRules = normalizeStoredMobileReplacementRules(JSON.parse(rawReplacementRules))
    } catch {
      replacementRules = {}
    }
  }

  let replacementRuleTexts: Record<string, string> = {}
  const rawReplacementRuleTexts = safeLocalStorageGet(READER_REPLACEMENT_RULE_TEXTS_STORAGE_KEY)
  if (rawReplacementRuleTexts) {
    try {
      replacementRuleTexts = normalizeStoredMobileReplacementRuleTexts(JSON.parse(rawReplacementRuleTexts))
    } catch {
      replacementRuleTexts = {}
    }
  }

  return {
    positions,
    preference,
    replacementRules,
    replacementRuleTexts,
    lastOpenedSession,
    lastBookSnapshot,
    recentFiles: stripRecentFileContent(recentFiles)
  }
}

function normalizeStoredMobileReplacementRules(rawValue: unknown): Record<string, ReplacementRule[]> {
  if (!rawValue || typeof rawValue !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(rawValue as Record<string, unknown>).map(([sourceKey, rules]) => [sourceKey, normalizeReplacementRules(rules)])
  )
}

function normalizeStoredMobileReplacementRuleTexts(rawValue: unknown): Record<string, string> {
  if (!rawValue || typeof rawValue !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(rawValue as Record<string, unknown>).filter(([, value]) => typeof value === 'string')
  ) as Record<string, string>
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
  if (isEditableTarget(event.target)) {
    return
  }

  const volumePageDirection = getVolumePageDirection(event)
  if (
    mdReaderCompactReadingMode.value &&
    volumePageDirection !== null &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey
  ) {
    event.preventDefault()
    if (volumePageDirection < 0) {
      goToPreviousPage()
    } else {
      goToNextPage()
    }
    return
  }

  if (event.ctrlKey && event.key === 'ArrowLeft') {
    event.preventDefault()
    void goToPreviousChapter()
    return
  }

  if (event.ctrlKey && event.key === 'ArrowRight') {
    event.preventDefault()
    void goToNextChapter()
    return
  }

  if (event.ctrlKey && event.key === 'ArrowUp') {
    event.preventDefault()
    goToPreviousPage()
    return
  }

  if (event.ctrlKey && event.key === 'ArrowDown') {
    event.preventDefault()
    goToNextPage()
    return
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === ' ' || event.code === 'Space')) {
    event.preventDefault()
    goToNextPage()
    return
  }

  if (event.ctrlKey && event.shiftKey && (event.key === 'f' || event.key === 'F')) {
    event.preventDefault()
    toggleSearchPanel()
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

  const contentPadding = Number(mergedPreference.contentPadding)
  if (!Number.isFinite(contentPadding)) {
    mergedPreference.contentPadding = DEFAULT_READER_PREFERENCE.contentPadding
  } else {
    mergedPreference.contentPadding = clampNumber(Math.round(contentPadding), 8, 40)
  }

  return mergedPreference
}

function isReaderThemeKey(value: string): value is ReaderThemeKey {
  return READER_THEME_OPTIONS.some((theme) => theme.key === value)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function toggleSearchPanel(): void {
  mdReaderSearchPanelVisible.value = !mdReaderSearchPanelVisible.value
  if (mdReaderSearchPanelVisible.value) {
    void nextTick(() => {
      mdReaderSearchPanelRef.value?.focusSearchInput()
    })
  }
}

function closeSearchPanel(): void {
  mdReaderSearchPanelVisible.value = false
}

async function handleSearchNavigate(payload: SearchNavigatePayload): Promise<void> {
  writeReaderDebugLog('search:navigate', {
    filePath: payload.filePath,
    lineNumber: payload.lineNumber,
    column: payload.column,
    tabId: payload.tabId ?? null
  })

  if (payload.tabId) {
    const tab = mdReaderTabs.value.find((t) => t.id === payload.tabId)
    if (tab) {
      await activateReaderTab(tab.id)
      navigateToLineInCurrentDocument(tab.markdownText, payload.lineNumber)
      return
    }
  }

  const tabByPath = mdReaderTabs.value.find(
    (t) => t.filePath === payload.filePath || t.sourceKey === payload.filePath
  )
  if (tabByPath) {
    await activateReaderTab(tabByPath.id)
    navigateToLineInCurrentDocument(tabByPath.markdownText, payload.lineNumber)
    return
  }

  if (mdReaderSupportsPathOpen.value) {
    try {
      await loadMarkdownFile(payload.filePath)
      const newTab = mdReaderTabs.value.find((t) => t.filePath === payload.filePath)
      if (newTab) {
        navigateToLineInCurrentDocument(newTab.markdownText, payload.lineNumber)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      mdReaderStatusText.value = `打开搜索结果文件失败：${message}`
    }
  }
}

function navigateToLineInCurrentDocument(markdownText: string, lineNumber: number): void {
  const chapters = mdReaderParsedDocument.value?.chapters
  if (!chapters || chapters.length === 0) {
    return
  }

  const chapterTexts = chapters.map((c) => c.markdown)
  const targetChapterIndex = findChapterIndexAtLine(chapterTexts, lineNumber)

  if (targetChapterIndex !== mdReaderActiveChapterIndex.value) {
    void handleChapterSwitch(targetChapterIndex)
  }
}
</script>

<template>
  <div
    class="md-reader-app-root"
    :style="{ '--md-reader-reading-background-color': mdReaderPreference.backgroundColor }"
    :class="{
      'md-reader-app-root-compact': mdReaderIsCompactLoadedMode,
      'md-reader-app-root-compact-reading': mdReaderCompactReadingMode,
      'md-reader-app-root-compact-controls-hidden': mdReaderCompactReadingMode && !mdReaderReadingControlsVisible
    }"
  >
    <header class="md-reader-header-section">
      <h1 class="md-reader-header-title">纪 Reader</h1>
      <p v-if="mdReaderShowsConfigPanel || !mdReaderHasLoadedDocument" class="md-reader-header-description">
        可按标题分章阅读，支持记录阅读进度与样式偏好。
      </p>

      <nav v-if="mdReaderHasOpenTabs" class="md-reader-tab-strip" aria-label="已打开文件">
        <div
          v-for="tab in mdReaderTabs"
          :key="tab.id"
          class="md-reader-tab-item"
          :class="{ 'md-reader-tab-item-active': tab.id === mdReaderActiveTabId }"
          draggable="true"
          @dragstart="handleTabDragStart(tab.id, $event)"
          @dragover.prevent
          @drop.prevent="handleTabDrop(tab.id)"
          @dragend="handleTabDragEnd"
        >
          <button type="button" class="md-reader-tab-select-button" :title="tab.sourceLabel" @click="activateReaderTab(tab.id)">
            <span class="md-reader-tab-dirty-dot" :class="{ 'md-reader-tab-dirty-dot-visible': tab.isDirty }" aria-hidden="true"></span>
            <span class="md-reader-tab-label">{{ displayTabLabel(tab) }}</span>
          </button>
          <button type="button" class="md-reader-tab-close-button" :aria-label="`关闭 ${displayTabLabel(tab)}`" @click.stop="closeReaderTab(tab.id)">
            ×
          </button>
        </div>
      </nav>

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
              <button
                v-if="mdReaderSupportsPathOpen"
                type="button"
                class="md-reader-open-form-save-button"
                :disabled="!mdReaderCanSaveCurrentTab || mdReaderIsLoading"
                @click="saveCurrentMarkdownTab"
              >
                保存当前标签
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

      <div class="md-reader-header-action-row">
        <button
          type="button"
          class="md-reader-open-form-dialog-button"
          :aria-pressed="mdReaderSearchPanelVisible"
          @click="toggleSearchPanel"
        >
          搜索（Ctrl+Shift+F）
        </button>
      </div>

      <p class="md-reader-open-status-text" role="status">{{ mdReaderStatusText }}</p>
      <p v-if="mdReaderUnsavedTabCount > 0" class="md-reader-unsaved-status-text">
        {{ mdReaderUnsavedTabCount }} 个标签页未保存
      </p>
    </header>

    <div class="md-reader-workspace-shell" :class="{ 'md-reader-workspace-shell-reading-only': mdReaderCompactReadingMode }">
      <aside v-if="mdReaderShowsConfigPanel" class="md-reader-workspace-sidebar">
        <button
          v-if="mdReaderIsCompactLoadedMode && !mdReaderCompactReadingMode"
          type="button"
          class="md-reader-compact-panel-back-button"
          @click="closeCompactPanel"
        >
          返回阅读
        </button>
        <details v-if="mdReaderSearchPanelVisible" class="md-reader-sidebar-panel-details" open>
          <summary class="md-reader-sidebar-panel-summary">搜索</summary>
          <section class="md-reader-sidebar-panel-content-section" aria-label="搜索面板">
            <SearchPanel
              ref="mdReaderSearchPanelRef"
              :open-tabs="mdReaderSearchOpenTabs"
              :active-tab-file-path="mdReaderActiveTabFilePath"
              :supports-path-open="mdReaderSupportsPathOpen"
              @navigate="handleSearchNavigate"
              @close="closeSearchPanel"
            />
          </section>
        </details>

        <details v-if="mdReaderShowChapterPanel" class="md-reader-sidebar-panel-details" open>
          <summary class="md-reader-sidebar-panel-summary">目录</summary>
          <section class="md-reader-sidebar-panel-content-section" aria-label="目录面板">
            <ChapterList :chapters="mdReaderChapterItems" :active-index="mdReaderActiveChapterIndex" @select="handleChapterSwitch" />
          </section>
        </details>

        <details v-if="mdReaderShowSettingsPanel" class="md-reader-sidebar-panel-details" open>
          <summary class="md-reader-sidebar-panel-summary">阅读样式</summary>
          <section class="md-reader-sidebar-panel-content-section" aria-label="阅读样式面板">
            <section class="md-reader-compact-file-shell-section" aria-label="文件控制">
              <p class="md-reader-compact-file-title">文件</p>
              <p class="md-reader-current-file-summary" data-testid="md-reader-current-file">
                当前打开：<strong>{{ mdReaderActiveTab ? displayTabLabel(mdReaderActiveTab) : '未打开文件' }}</strong>
              </p>
              <form class="md-reader-open-form" @submit.prevent="openMarkdownByPath" aria-label="移动端打开 Markdown 文件">
                <template v-if="mdReaderSupportsPathOpen">
                  <label class="md-reader-open-form-label" for="md-reader-compact-path-input">Markdown 路径</label>
                  <input
                    id="md-reader-compact-path-input"
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
                  <button
                    v-if="mdReaderSupportsPathOpen"
                    type="button"
                    class="md-reader-open-form-save-button"
                    :disabled="!mdReaderCanSaveCurrentTab || mdReaderIsLoading"
                    @click="saveCurrentMarkdownTab"
                  >
                    保存当前标签
                  </button>
                </div>
              </form>
              <section v-if="mdReaderRecentFiles.length > 0" class="md-reader-recent-files-section" aria-label="最近打开的文件">
                <p class="md-reader-recent-files-title">最近打开（{{ mdReaderRecentFiles.length }}/10）</p>
                <ol class="md-reader-recent-files-list">
                  <li v-for="file in mdReaderRecentFiles" :key="file.sourceKey" class="md-reader-recent-file-item">
                    <button
                      type="button"
                      class="md-reader-recent-file-button"
                      :class="{ 'md-reader-recent-file-button-active': file.sourceKey === mdReaderCurrentSourceKey }"
                      :disabled="mdReaderIsLoading"
                      :aria-current="file.sourceKey === mdReaderCurrentSourceKey ? 'page' : undefined"
                      :title="file.sourceLabel"
                      @click="openRecentFile(file)"
                    >
                      {{ displayRecentFileLabel(file) }}
                    </button>
                  </li>
                </ol>
              </section>
            </section>
            <ReaderSettings
              :preference="mdReaderPreference"
              :themes="READER_THEME_OPTIONS"
              :source-label="mdReaderActiveTab ? displayTabLabel(mdReaderActiveTab) : undefined"
              :replacement-rules="mdReaderReplacementRules"
              :replacement-rules-text="mdReaderReplacementRulesText"
              @change="handlePreferenceChange"
              @replacement-input="handleReplacementInput"
              @replacement-change="handleReplacementChange"
            />
            <div class="md-reader-fix-chapter-section">
              <button
                type="button"
                class="md-reader-fix-chapter-button"
                :disabled="mdReaderIsLoading || !mdReaderHasLoadedDocument"
                @click="fixChapterOrderAndReload"
              >
                修复章节顺序
              </button>
            </div>
          </section>
        </details>
      </aside>

      <main class="md-reader-workspace-main" aria-label="阅读区域">
        <nav v-if="mdReaderShowTopbar" class="md-reader-compact-topbar-nav" aria-label="移动端阅读控制">
          <button
            type="button"
            class="md-reader-compact-topbar-button"
            :aria-pressed="mdReaderCompactPanel === 'settings'"
            aria-label="阅读设置"
            title="阅读设置"
            @click="toggleCompactPanel('settings')"
          >
            设置
          </button>
          <p class="md-reader-compact-topbar-title">{{ mdReaderCurrentChapterTitle }}</p>
          <button
            type="button"
            class="md-reader-compact-topbar-button"
            :aria-pressed="mdReaderCompactPanel === 'chapters'"
            aria-label="章节目录"
            title="章节目录"
            @click="toggleCompactPanel('chapters')"
          >
            目录
          </button>
          <button
            type="button"
            class="md-reader-compact-topbar-button md-reader-reading-controls-hide-button"
            aria-label="隐藏阅读控件"
            title="隐藏顶部和底部阅读控件"
            @click="mdReaderReadingControlsVisible = false"
          >
            隐藏
          </button>
        </nav>

        <div v-if="mdReaderShowReadingControlsReveal" class="md-reader-hidden-reading-topbar" aria-label="隐藏模式阅读标题">
          <p class="md-reader-hidden-reading-title">{{ mdReaderCurrentChapterTitle }}</p>
          <button
            type="button"
            class="md-reader-reading-controls-reveal-button"
            data-testid="md-reader-reading-controls-reveal"
            data-shape="circle"
            aria-label="显示阅读控件"
            title="显示顶部和底部阅读控件"
            @click="mdReaderReadingControlsVisible = true"
          >
            <span aria-hidden="true">⌃</span>
          </button>
        </div>

        <ReaderHiddenNavigation
          v-if="mdReaderShowHiddenNavigation"
          :can-scroll-previous="mdReaderCanScrollPrevious"
          :can-scroll-next="mdReaderCanScrollNext"
          :has-previous-chapter="mdReaderHasPreviousChapter"
          :has-next-chapter="mdReaderHasNextChapter"
          @previous-page="goToPreviousPage"
          @next-page="goToNextPage"
          @previous-chapter="goToPreviousChapter"
          @next-chapter="goToNextChapter"
        />

        <section class="md-reader-workspace-article-section">
          <ReaderArticle
            ref="mdReaderArticleRef"
            :chapter="mdReaderCurrentChapter"
            :preference="mdReaderPreference"
            :replacement-rules="mdReaderReplacementRules"
            :hide-title="mdReaderIsCompactLoadedMode"
            :initial-scroll-top="mdReaderRestoredScrollTop"
            @scroll-change="handleReaderScrollChange"
          />
        </section>

        <ReaderNavigationControls
          v-if="!mdReaderIsCompactLoadedMode || (mdReaderCompactReadingMode && mdReaderShowReadingControls)"
          :compact="mdReaderIsCompactLayout"
          :can-scroll-previous="mdReaderCanScrollPrevious"
          :can-scroll-next="mdReaderCanScrollNext"
          :has-previous-chapter="mdReaderHasPreviousChapter"
          :has-next-chapter="mdReaderHasNextChapter"
          :chapter-progress-text="mdReaderChapterProgressText"
          @previous-page="goToPreviousPage"
          @next-page="goToNextPage"
          @previous-chapter="goToPreviousChapter"
          @next-chapter="goToNextChapter"
        />
      </main>
    </div>
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
  --md-surface-0: #f4efe2;
  --md-surface-1: rgba(255, 255, 255, 0.78);
  --md-surface-2: #fff9ee;
  --md-stroke: #d2c5a6;
  --md-stroke-strong: #8c7a57;
  --md-text-main: #1f1b14;
  --md-text-subtle: #544a35;
  --md-accent: #6b5220;
  --md-accent-weak: #ece1c6;
  --md-shadow-soft: 0 10px 32px rgba(62, 49, 20, 0.12);
  --md-focus-ring: 0 0 0 3px rgba(107, 82, 32, 0.26);
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
    radial-gradient(circle at 8% 8%, #f6e5bd 0%, transparent 36%),
    radial-gradient(circle at 88% 16%, #ece0c4 0%, transparent 40%),
    linear-gradient(180deg, #f3efe4 0%, #ece5d7 100%);
  color: var(--md-text-main);
  font-family: 'Source Han Serif SC', 'PingFang SC', serif;
}

.md-reader-app-root-compact {
  padding: 10px;
  gap: 10px;
}

.md-reader-app-root-compact .md-reader-header-section {
  display: none;
}

.md-reader-app-root-compact-reading .md-reader-workspace-shell-reading-only {
  grid-template-rows: minmax(0, 1fr);
}

.md-reader-app-root-compact-reading {
  padding: 0;
  gap: 0;
  background: var(--md-reader-reading-background-color);
}

.md-reader-app-root-compact-reading .md-reader-workspace-shell {
  gap: 0;
}

.md-reader-app-root-compact-reading .md-reader-workspace-main {
  gap: 0;
}

.md-reader-app-root-compact-reading .md-reader-workspace-article-section :deep(.md-reader-article-body-article) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.md-reader-app-root-compact-controls-hidden .md-reader-workspace-article-section :deep(.md-reader-article-body-article) {
  padding-top: calc(var(--md-reader-content-padding) + 34px);
  padding-bottom: calc(var(--md-reader-content-padding) + 196px);
}

.md-reader-header-section {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--md-stroke);
  background: var(--md-surface-1);
  box-shadow: var(--md-shadow-soft);
  backdrop-filter: blur(3px);
}

.md-reader-header-title {
  margin-top: 0;
  margin-bottom: 8px;
  color: var(--md-text-main);
  letter-spacing: 0.02em;
}

.md-reader-header-description {
  margin-top: 0;
  margin-bottom: 14px;
  color: var(--md-text-subtle);
}

.md-reader-tab-strip {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  padding-bottom: 2px;
  overflow-x: auto;
  scrollbar-gutter: stable;
}

.md-reader-tab-item {
  min-width: 140px;
  max-width: 260px;
  min-height: 36px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  align-items: center;
  border: 1px solid var(--md-stroke);
  border-radius: 8px;
  background: rgba(255, 250, 240, 0.78);
}

.md-reader-tab-item-active {
  border-color: var(--md-stroke-strong);
  background: var(--md-surface-2);
  box-shadow: inset 0 -2px 0 var(--md-accent);
}

.md-reader-tab-select-button,
.md-reader-tab-close-button {
  border: 0;
  background: transparent;
  color: var(--md-text-main);
  cursor: pointer;
}

.md-reader-tab-select-button {
  min-width: 0;
  min-height: 36px;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  text-align: left;
}

.md-reader-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.md-reader-tab-dirty-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.md-reader-tab-dirty-dot-visible {
  background: #9f5a16;
}

.md-reader-tab-close-button {
  width: 32px;
  min-height: 32px;
  border-left: 1px solid rgba(140, 122, 87, 0.25);
  font-size: 18px;
  line-height: 1;
}

.md-reader-tab-close-button:hover {
  background: rgba(140, 122, 87, 0.12);
}

.md-reader-header-panel-details {
  border: 1px solid var(--md-stroke);
  border-radius: 12px;
  background: var(--md-surface-2);
}

.md-reader-header-panel-summary {
  cursor: pointer;
  font-weight: 700;
  padding: 12px;
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
  min-height: 40px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--md-stroke);
  border-radius: 10px;
  background: #ffffff;
  color: var(--md-text-main);
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
.md-reader-open-form-save-button,
.md-reader-compact-topbar-button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--md-stroke-strong);
  border-radius: 10px;
  background: linear-gradient(180deg, #fffdf7 0%, #f6edd9 100%);
  color: var(--md-text-main);
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
  box-shadow: 0 3px 10px rgba(57, 45, 20, 0.12);
}

.md-reader-open-form-submit-button:hover,
.md-reader-open-form-dialog-button:hover,
.md-reader-open-form-save-button:hover,
.md-reader-compact-topbar-button:hover {
  filter: brightness(1.01);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(57, 45, 20, 0.18);
}

.md-reader-open-form-submit-button:active,
.md-reader-open-form-dialog-button:active,
.md-reader-open-form-save-button:active,
.md-reader-compact-topbar-button:active {
  transform: translateY(0);
}

.md-reader-open-form-submit-button:focus-visible,
.md-reader-open-form-dialog-button:focus-visible,
.md-reader-open-form-save-button:focus-visible,
.md-reader-compact-topbar-button:focus-visible,
.md-reader-open-form-path-input:focus-visible {
  outline: none;
  box-shadow: var(--md-focus-ring);
}

.md-reader-open-form-submit-button:disabled,
.md-reader-open-form-dialog-button:disabled,
.md-reader-open-form-save-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.md-reader-open-status-text {
  margin-top: 10px;
  margin-bottom: 0;
  font-size: 13px;
  color: var(--md-text-subtle);
}

.md-reader-unsaved-status-text {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: #8a4a13;
}

.md-reader-header-action-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.md-reader-fix-chapter-section {
  padding: 12px;
  border-top: 1px solid var(--md-stroke);
}

.md-reader-fix-chapter-button {
  width: 100%;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--md-stroke-strong);
  border-radius: 10px;
  background: linear-gradient(180deg, #fffdf7 0%, #f6edd9 100%);
  color: var(--md-text-main);
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
  box-shadow: 0 3px 10px rgba(57, 45, 20, 0.12);
}

.md-reader-fix-chapter-button:hover:not(:disabled) {
  filter: brightness(1.01);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(57, 45, 20, 0.18);
}

.md-reader-fix-chapter-button:active:not(:disabled) {
  transform: translateY(0);
}

.md-reader-fix-chapter-button:focus-visible {
  outline: none;
  box-shadow: var(--md-focus-ring);
}

.md-reader-fix-chapter-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
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
  border: 1px solid var(--md-stroke);
  border-radius: 12px;
  background: var(--md-surface-2);
  box-shadow: var(--md-shadow-soft);
}

.md-reader-sidebar-panel-summary {
  cursor: pointer;
  user-select: none;
  font-weight: 700;
  padding: 11px 12px;
}

.md-reader-sidebar-panel-content-section {
  padding: 6px 12px 12px;
}

.md-reader-compact-panel-back-button {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--md-stroke-strong);
  border-radius: 10px;
  background: rgba(255, 253, 247, 0.82);
  color: var(--md-text-main);
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.md-reader-compact-panel-back-button:focus-visible {
  outline: none;
  box-shadow: var(--md-focus-ring);
}

.md-reader-compact-file-shell-section {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--md-stroke);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.62);
}

.md-reader-compact-file-title {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--md-text-subtle);
}

.md-reader-current-file-summary {
  margin: 0 0 8px;
  overflow: hidden;
  color: var(--md-text-main);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md-reader-recent-files-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(140, 122, 87, 0.28);
}

.md-reader-recent-files-title {
  margin: 0 0 6px;
  color: var(--md-text-subtle);
  font-size: 12px;
  font-weight: 700;
}

.md-reader-recent-files-list {
  display: grid;
  gap: 5px;
  max-height: 220px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.md-reader-recent-file-button {
  width: 100%;
  min-height: 36px;
  padding: 0 9px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 8px;
  background: rgba(255, 250, 240, 0.74);
  color: var(--md-text-main);
  cursor: pointer;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md-reader-recent-file-button:hover:not(:disabled),
.md-reader-recent-file-button-active {
  border-color: var(--md-stroke-strong);
  background: var(--md-accent-weak);
}

.md-reader-recent-file-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.md-reader-workspace-main {
  position: relative;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
}

.md-reader-compact-topbar-nav {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--md-stroke);
  border-radius: 12px;
  background: var(--md-surface-2);
  box-shadow: var(--md-shadow-soft);
}

.md-reader-compact-topbar-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
  text-align: center;
  color: var(--md-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.md-reader-compact-topbar-button {
  min-width: 44px;
  min-height: 44px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  white-space: nowrap;
  line-height: 1;
}

.md-reader-compact-topbar-button[aria-pressed='true'] {
  border-color: #6f5627;
  background: linear-gradient(180deg, #f3e0b3 0%, #e8cc8f 100%);
}

.md-reader-reading-controls-hide-button {
  min-width: 52px;
  color: var(--md-text-subtle);
  font-size: 12px;
}

.md-reader-hidden-reading-topbar {
  position: absolute;
  top: 8px;
  left: 10px;
  right: 10px;
  z-index: 11;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.md-reader-hidden-reading-title {
  max-width: calc(100% - 48px);
  margin: 0;
  padding: 4px 10px;
  overflow: hidden;
  border: 1px solid rgba(111, 86, 39, 0.22);
  border-radius: 999px;
  background: rgba(255, 249, 238, 0.4);
  color: rgba(31, 27, 20, 0.68);
  font-size: 12px;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(57, 45, 20, 0.08);
  backdrop-filter: blur(6px);
}

.md-reader-reading-controls-reveal-button {
  position: relative;
  top: auto;
  right: auto;
  min-width: 32px;
  min-height: 32px;
  width: 32px;
  height: 32px;
  margin-left: 8px;
  padding: 0;
  border: 1px solid rgba(111, 86, 39, 0.2);
  border-radius: 50%;
  background: rgba(255, 249, 238, 0.22);
  color: rgba(31, 27, 20, 0.5);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.44;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.md-reader-reading-controls-reveal-button:active {
  background: rgba(255, 249, 238, 0.52);
  opacity: 0.82;
}

.md-reader-reading-controls-reveal-button:focus-visible {
  outline: none;
  opacity: 0.9;
  box-shadow: var(--md-focus-ring);
}

.md-reader-workspace-article-section {
  min-height: 0;
}

.md-reader-workspace-article-section :deep(.md-reader-article-body-article) {
  padding-bottom: calc(var(--md-reader-content-padding) + 112px);
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
    max-height: 56vh;
    padding-right: 0;
  }

  .md-reader-workspace-main {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .md-reader-compact-topbar-nav {
    gap: 8px;
    padding: 8px;
  }

  .md-reader-compact-topbar-title {
    font-size: 12px;
  }

  .md-reader-compact-topbar-button {
    min-width: 44px;
    min-height: 44px;
    padding: 0 8px;
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .md-reader-open-form-submit-button,
  .md-reader-open-form-dialog-button,
  .md-reader-open-form-save-button,
  .md-reader-compact-topbar-button {
    transition: none;
  }
}
</style>
