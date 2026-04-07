import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { DEFAULT_READER_PREFERENCE } from '../shared/reader-defaults'
import { getReaderThemeOption, READER_THEME_OPTIONS } from '../shared/reader-themes'
import type { ReaderLastOpenedSession, ReaderPreference, ReaderPosition, ReaderThemeKey } from '../shared/reader-types'

interface ReaderStoreData {
  positions: Record<string, ReaderPosition>
  preference: ReaderPreference
  lastOpenedSession: ReaderLastOpenedSession | null
}

export { DEFAULT_READER_PREFERENCE }

export function createReaderStore(storagePath: string) {
  async function loadPosition(filePath: string): Promise<ReaderPosition | null> {
    const data = await readStoreData(storagePath)
    return data.positions[filePath] ?? null
  }

  async function savePosition(filePath: string, value: ReaderPosition): Promise<void> {
    const data = await readStoreData(storagePath)
    data.positions[filePath] = value
    await writeStoreData(storagePath, data)
  }

  async function loadPreference(): Promise<ReaderPreference> {
    const data = await readStoreData(storagePath)
    return data.preference
  }

  async function savePreference(value: ReaderPreference): Promise<void> {
    const data = await readStoreData(storagePath)
    data.preference = value
    await writeStoreData(storagePath, data)
  }

  async function loadLastOpenedSession(): Promise<ReaderLastOpenedSession | null> {
    const data = await readStoreData(storagePath)
    return data.lastOpenedSession
  }

  async function saveLastOpenedSession(value: ReaderLastOpenedSession | null): Promise<void> {
    const data = await readStoreData(storagePath)
    data.lastOpenedSession = value
    await writeStoreData(storagePath, data)
  }

  return {
    loadPosition,
    savePosition,
    loadPreference,
    savePreference,
    loadLastOpenedSession,
    saveLastOpenedSession
  }
}

async function readStoreData(storagePath: string): Promise<ReaderStoreData> {
  try {
    const text = await readFile(storagePath, 'utf-8')
    const parsed = JSON.parse(text) as Partial<ReaderStoreData>

    return {
      positions: parsed.positions ?? {},
      preference: normalizeStoredPreference(parsed.preference),
      lastOpenedSession: normalizeLastOpenedSession(parsed.lastOpenedSession)
    }
  } catch {
    return {
      positions: {},
      preference: DEFAULT_READER_PREFERENCE,
      lastOpenedSession: null
    }
  }
}

async function writeStoreData(storagePath: string, data: ReaderStoreData): Promise<void> {
  await mkdir(dirname(storagePath), { recursive: true })
  await writeFile(storagePath, JSON.stringify(data, null, 2), 'utf-8')
}

function normalizeStoredPreference(rawPreference?: Partial<ReaderPreference>): ReaderPreference {
  if (!rawPreference) {
    return DEFAULT_READER_PREFERENCE
  }

  const rawThemeKey = rawPreference.themeKey
  const validThemeKey = isReaderThemeKey(rawThemeKey) ? rawThemeKey : null
  const contentPadding = normalizeContentPadding(rawPreference.contentPadding)

  // Migration: old records without themeKey should not be shown as eyeCare by default.
  if (!validThemeKey) {
    const dayTheme = getReaderThemeOption('day')

    return {
      ...DEFAULT_READER_PREFERENCE,
      themeKey: 'day',
      fontColor: rawPreference.fontColor ?? dayTheme.fontColor,
      backgroundColor: rawPreference.backgroundColor ?? dayTheme.backgroundColor,
      fontSize: rawPreference.fontSize ?? DEFAULT_READER_PREFERENCE.fontSize,
      lineHeight: rawPreference.lineHeight ?? DEFAULT_READER_PREFERENCE.lineHeight,
      contentPadding
    }
  }

  // Migration fix: early theme rollout may save eyeCare key with legacy default colors.
  const shouldRepairEarlyEyeCare =
    validThemeKey === 'eyeCare' &&
    rawPreference.fontColor === '#1f1f1f' &&
    rawPreference.backgroundColor === '#f8f3e8'

  const theme = getReaderThemeOption(validThemeKey)

  return {
    ...DEFAULT_READER_PREFERENCE,
    themeKey: validThemeKey,
    fontColor: shouldRepairEarlyEyeCare ? theme.fontColor : rawPreference.fontColor ?? theme.fontColor,
    backgroundColor: shouldRepairEarlyEyeCare ? theme.backgroundColor : rawPreference.backgroundColor ?? theme.backgroundColor,
    fontSize: rawPreference.fontSize ?? DEFAULT_READER_PREFERENCE.fontSize,
    lineHeight: rawPreference.lineHeight ?? DEFAULT_READER_PREFERENCE.lineHeight,
    contentPadding
  }
}

function normalizeContentPadding(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_READER_PREFERENCE.contentPadding
  }

  return Math.min(Math.max(Math.round(value), 8), 40)
}

function isReaderThemeKey(value: unknown): value is ReaderThemeKey {
  return typeof value === 'string' && READER_THEME_OPTIONS.some((item) => item.key === value)
}

function normalizeLastOpenedSession(rawValue: unknown): ReaderLastOpenedSession | null {
  if (!rawValue || typeof rawValue !== 'object') {
    return null
  }

  const candidate = rawValue as Partial<ReaderLastOpenedSession>
  if (candidate.sourceType !== 'path' && candidate.sourceType !== 'cachedText') {
    return null
  }

  if (typeof candidate.sourceKey !== 'string' || typeof candidate.sourceLabel !== 'string') {
    return null
  }

  if (candidate.sourceType === 'path') {
    if (typeof candidate.filePath !== 'string' || candidate.filePath.length === 0) {
      return null
    }

    return {
      sourceType: 'path',
      sourceKey: candidate.sourceKey,
      sourceLabel: candidate.sourceLabel,
      filePath: candidate.filePath
    }
  }

  return {
    sourceType: 'cachedText',
    sourceKey: candidate.sourceKey,
    sourceLabel: candidate.sourceLabel
  }
}
