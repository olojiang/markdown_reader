/// <reference types="vite/client" />

import type { ReaderLastOpenedSession, ReaderPreference, ReaderPosition } from '@shared/reader-types'
import type { FileSearchResult, FolderSearchRequest } from '@shared/search-types'

declare global {
  interface Window {
    electronAPI: {
      pickMarkdownFile: () => Promise<string | null>
      readMarkdownFile: (filePath: string) => Promise<string>
      writeMarkdownFile: (filePath: string, content: string) => Promise<void>
      loadReaderPosition: (filePath: string) => Promise<ReaderPosition | null>
      saveReaderPosition: (filePath: string, value: ReaderPosition) => Promise<void>
      loadReaderPreference: () => Promise<ReaderPreference | null>
      saveReaderPreference: (value: ReaderPreference) => Promise<void>
      loadLastOpenedSession: () => Promise<ReaderLastOpenedSession | null>
      saveLastOpenedSession: (value: ReaderLastOpenedSession | null) => Promise<void>
      writeReaderDebugLog: (event: string, payload?: unknown) => Promise<void>
      searchInFolder: (request: FolderSearchRequest) => Promise<FileSearchResult>
    }
  }
}

export {}
