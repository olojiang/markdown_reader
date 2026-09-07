/// <reference types="vite/client" />

import type { ReaderLastOpenedSession, ReaderPreference, ReaderPosition, ReaderRecentFile } from '@shared/reader-types'
import type { ReplacementRule } from '@shared/replacement-rules'
import type { FileSearchResult, FolderSearchRequest } from '@shared/search-types'

declare global {
  interface Window {
    markdownReaderAndroid?: {
      setReadingMode: (isReadingMode: boolean) => void
    }
    electronAPI: {
      pickMarkdownFile: () => Promise<string | null>
      readMarkdownFile: (filePath: string) => Promise<string>
      writeMarkdownFile: (filePath: string, content: string) => Promise<void>
      loadReaderPosition: (filePath: string) => Promise<ReaderPosition | null>
      saveReaderPosition: (filePath: string, value: ReaderPosition) => Promise<void>
      loadReaderPreference: () => Promise<ReaderPreference | null>
      saveReaderPreference: (value: ReaderPreference) => Promise<void>
      loadReaderReplacementRules: (sourceKey: string) => Promise<ReplacementRule[]>
      saveReaderReplacementRules: (sourceKey: string, value: ReplacementRule[]) => Promise<void>
      loadReaderReplacementRulesText: (sourceKey: string) => Promise<string | null>
      saveReaderReplacementRulesText: (sourceKey: string, value: string) => Promise<void>
      loadLastOpenedSession: () => Promise<ReaderLastOpenedSession | null>
      saveLastOpenedSession: (value: ReaderLastOpenedSession | null) => Promise<void>
      loadRecentFiles: () => Promise<ReaderRecentFile[]>
      saveRecentFiles: (value: ReaderRecentFile[]) => Promise<void>
      writeReaderDebugLog: (event: string, payload?: unknown) => Promise<void>
      searchInFolder: (request: FolderSearchRequest) => Promise<FileSearchResult>
    }
  }
}

export {}
