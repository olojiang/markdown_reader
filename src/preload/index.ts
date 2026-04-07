import { contextBridge, ipcRenderer } from 'electron'

import type { ReaderPreference, ReaderPosition } from '../shared/reader-types'

const electronAPI = {
  pickMarkdownFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickMarkdownFile'),
  readMarkdownFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:readMarkdownFile', filePath),
  loadReaderPosition: (filePath: string): Promise<ReaderPosition | null> => ipcRenderer.invoke('reader:loadPosition', filePath),
  saveReaderPosition: (filePath: string, value: ReaderPosition): Promise<void> =>
    ipcRenderer.invoke('reader:savePosition', filePath, value),
  loadReaderPreference: (): Promise<ReaderPreference | null> => ipcRenderer.invoke('reader:loadPreference'),
  saveReaderPreference: (value: ReaderPreference): Promise<void> => ipcRenderer.invoke('reader:savePreference', value)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
