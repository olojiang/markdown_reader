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

export type ReaderThemeKey = 'day' | 'night' | 'eyeCare'

export interface ReaderPreference {
  themeKey: ReaderThemeKey
  fontSize: number
  lineHeight: number
  fontColor: string
  backgroundColor: string
}
