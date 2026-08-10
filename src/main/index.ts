import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { app, BrowserWindow, dialog, ipcMain } from 'electron'

import type { ReaderLastOpenedSession, ReaderPreference, ReaderPosition } from '../shared/reader-types'
import type { ReplacementRule } from '../shared/replacement-rules'
import type { FolderSearchRequest } from '../shared/search-types'

import { searchInFolder } from './file-search'
import { createReaderLogger, type ReaderLogger } from './reader-logger'
import { createReaderStore } from './reader-store'

let mainWindow: BrowserWindow | null = null
let readerLogger: ReaderLogger | null = null
let isQuitting = false

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  })
}

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
  mainWindow.maximize()
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  const readerLogDirectory = app.getPath('logs')
  readerLogger = createReaderLogger(readerLogDirectory)
  const appendReaderDebugLog = async (event: string, payload?: unknown): Promise<void> => {
    await readerLogger?.log(event, payload)
  }

  const readerStore = createReaderStore(join(userDataPath, 'reader-store.json'), (event, payload) => {
    void appendReaderDebugLog(`store:${event}`, payload)
  })

  void appendReaderDebugLog('app:ready', {
    userDataPath,
    readerStorePath: join(userDataPath, 'reader-store.json'),
    readerLogDirectory
  })

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

  ipcMain.handle('file:writeMarkdownFile', async (_, filePath: string, content: string) => {
    await writeFile(filePath, content, 'utf-8')
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

  ipcMain.handle('reader:loadReplacementRules', async (_, sourceKey: string): Promise<ReplacementRule[]> => {
    return readerStore.loadReplacementRules(sourceKey)
  })

  ipcMain.handle('reader:saveReplacementRules', async (_, sourceKey: string, value: ReplacementRule[]): Promise<void> => {
    await readerStore.saveReplacementRules(sourceKey, value)
  })

  ipcMain.handle('reader:loadReplacementRulesText', async (_, sourceKey: string): Promise<string | null> => {
    return readerStore.loadReplacementRulesText(sourceKey)
  })

  ipcMain.handle('reader:saveReplacementRulesText', async (_, sourceKey: string, value: string): Promise<void> => {
    await readerStore.saveReplacementRulesText(sourceKey, value)
  })

  ipcMain.handle('reader:loadLastOpenedSession', async (): Promise<ReaderLastOpenedSession | null> => {
    return readerStore.loadLastOpenedSession()
  })

  ipcMain.handle('reader:saveLastOpenedSession', async (_, value: ReaderLastOpenedSession | null): Promise<void> => {
    await readerStore.saveLastOpenedSession(value)
  })

  ipcMain.handle('reader:debugLog', async (_, event: string, payload?: unknown): Promise<void> => {
    await appendReaderDebugLog(`renderer:${event}`, payload)
  })

  ipcMain.handle('search:searchInFolder', async (_, request: FolderSearchRequest) => {
    void appendReaderDebugLog('search:folder:start', {
      query: request.query,
      folderPath: request.folderPath,
      isRegex: request.isRegex,
      excludeFolders: request.excludeFolders
    })

    const result = await searchInFolder(request)

    void appendReaderDebugLog('search:folder:complete', {
      matchCount: result.matches.length,
      searchedFiles: result.searchedFiles,
      truncated: result.truncated
    })

    return result
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
  }).catch((error: unknown) => {
    console.error('Failed to start Markdown Reader', error)
    app.quit()
  })
}

app.on('before-quit', (event) => {
  if (isQuitting) {
    return
  }

  isQuitting = true
  event.preventDefault()

  const logger = readerLogger
  if (!logger) {
    app.exit(0)
    return
  }

  void logger
    .log('app:before-quit')
    .then(() => logger.close())
    .then(() => app.exit(0))
})

app.on('window-all-closed', () => {
  app.quit()
})
