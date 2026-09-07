export interface ChapterItem {
  id: string
  title: string
  markdown: string
  order: number
}

export interface ParsedDocument {
  documentTitle: string
  chapters: ChapterItem[]
}

export interface ReaderPosition {
  chapterIndex: number
  scrollTop: number
}

export interface ReaderLastOpenedSession {
  sourceType: 'path' | 'cachedText'
  sourceKey: string
  sourceLabel: string
  filePath?: string
  tabs?: ReaderSessionTab[]
  activeTabId?: string
}

export interface ReaderSessionTab {
  id: string
  sourceType: 'path' | 'cachedText'
  sourceKey: string
  sourceLabel: string
  filePath?: string
}

export interface ReaderRecentFile {
  sourceType: 'path' | 'cachedText'
  sourceKey: string
  sourceLabel: string
  filePath?: string
  markdownText?: string
  lastOpenedAt: number
}

export type ReaderThemeKey = 'day' | 'night' | 'eyeCare'

export interface ReaderPreference {
  themeKey: ReaderThemeKey
  fontSize: number
  lineHeight: number
  contentPadding: number
  fontColor: string
  backgroundColor: string
}

export interface ChapterFixItem {
  originalIndex: number
  originalTitle: string
  chapterNumber: number | null
  correctedTitle: string
}

export interface FixReport {
  isOrdered: boolean
  totalChapters: number
  fixedCount: number
  items: ChapterFixItem[]
}

export interface FixResult {
  fixedMarkdown: string
  report: FixReport
}
