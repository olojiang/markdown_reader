import { contextBridge, ipcRenderer } from 'electron'

import type { ReaderLastOpenedSession, ReaderPreference, ReaderPosition } from '../shared/reader-types'

const electronAPI = {
  pickMarkdownFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickMarkdownFile'),
  readMarkdownFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:readMarkdownFile', filePath),
  writeMarkdownFile: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke('file:writeMarkdownFile', filePath, content),
  loadReaderPosition: (filePath: string): Promise<ReaderPosition | null> => ipcRenderer.invoke('reader:loadPosition', filePath),
  saveReaderPosition: (filePath: string, value: ReaderPosition): Promise<void> =>
    ipcRenderer.invoke('reader:savePosition', filePath, value),
  loadReaderPreference: (): Promise<ReaderPreference | null> => ipcRenderer.invoke('reader:loadPreference'),
  saveReaderPreference: (value: ReaderPreference): Promise<void> => ipcRenderer.invoke('reader:savePreference', value),
  loadLastOpenedSession: (): Promise<ReaderLastOpenedSession | null> => ipcRenderer.invoke('reader:loadLastOpenedSession'),
  saveLastOpenedSession: (value: ReaderLastOpenedSession | null): Promise<void> =>
    ipcRenderer.invoke('reader:saveLastOpenedSession', value),
  writeReaderDebugLog: (event: string, payload?: unknown): Promise<void> => ipcRenderer.invoke('reader:debugLog', event, payload)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
