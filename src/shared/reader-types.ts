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
