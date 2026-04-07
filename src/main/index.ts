import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { app, BrowserWindow, dialog, ipcMain } from 'electron'

import type { ReaderLastOpenedSession, ReaderPreference, ReaderPosition } from '../shared/reader-types'

import { createReaderStore } from './reader-store'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: '纪 Reader',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const readerStore = createReaderStore(join(app.getPath('userData'), 'reader-store.json'))

  ipcMain.handle('dialog:pickMarkdownFile', async () => {
    if (!mainWindow) {
      return null
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('file:readMarkdownFile', async (_, filePath: string) => {
    const fileText = await readFile(filePath, 'utf-8')
    return fileText
  })

  ipcMain.handle('reader:loadPosition', async (_, filePath: string): Promise<ReaderPosition | null> => {
    return readerStore.loadPosition(filePath)
  })

  ipcMain.handle('reader:savePosition', async (_, filePath: string, value: ReaderPosition): Promise<void> => {
    await readerStore.savePosition(filePath, value)
  })

  ipcMain.handle('reader:loadPreference', async (): Promise<ReaderPreference | null> => {
    return readerStore.loadPreference()
  })

  ipcMain.handle('reader:savePreference', async (_, value: ReaderPreference): Promise<void> => {
    await readerStore.savePreference(value)
  })

  ipcMain.handle('reader:loadLastOpenedSession', async (): Promise<ReaderLastOpenedSession | null> => {
    return readerStore.loadLastOpenedSession()
  })

  ipcMain.handle('reader:saveLastOpenedSession', async (_, value: ReaderLastOpenedSession | null): Promise<void> => {
    await readerStore.saveLastOpenedSession(value)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
