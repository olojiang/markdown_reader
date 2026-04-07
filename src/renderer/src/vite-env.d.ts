/// <reference types="vite/client" />

import type { ReaderPreference, ReaderPosition } from '@shared/reader-types'

declare global {
  interface Window {
    electronAPI: {
      pickMarkdownFile: () => Promise<string | null>
      readMarkdownFile: (filePath: string) => Promise<string>
      loadReaderPosition: (filePath: string) => Promise<ReaderPosition | null>
      saveReaderPosition: (filePath: string, value: ReaderPosition) => Promise<void>
      loadReaderPreference: () => Promise<ReaderPreference | null>
      saveReaderPreference: (value: ReaderPreference) => Promise<void>
    }
  }
}

export {}
