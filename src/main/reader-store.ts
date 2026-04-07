import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { DEFAULT_READER_PREFERENCE } from '../shared/reader-defaults'
import { getReaderThemeOption, READER_THEME_OPTIONS } from '../shared/reader-themes'
import type { ReaderPreference, ReaderPosition, ReaderThemeKey } from '../shared/reader-types'

interface ReaderStoreData {
  positions: Record<string, ReaderPosition>
  preference: ReaderPreference
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

  return {
    loadPosition,
    savePosition,
    loadPreference,
    savePreference
  }
}

async function readStoreData(storagePath: string): Promise<ReaderStoreData> {
  try {
    const text = await readFile(storagePath, 'utf-8')
    const parsed = JSON.parse(text) as Partial<ReaderStoreData>

    return {
      positions: parsed.positions ?? {},
      preference: normalizeStoredPreference(parsed.preference)
    }
  } catch {
    return {
      positions: {},
      preference: DEFAULT_READER_PREFERENCE
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

  // Migration: old records without themeKey should not be shown as eyeCare by default.
  if (!validThemeKey) {
    return {
      ...DEFAULT_READER_PREFERENCE,
      themeKey: 'day',
      ...(rawPreference as Omit<ReaderPreference, 'themeKey'>)
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
    lineHeight: rawPreference.lineHeight ?? DEFAULT_READER_PREFERENCE.lineHeight
  }
}

function isReaderThemeKey(value: unknown): value is ReaderThemeKey {
  return typeof value === 'string' && READER_THEME_OPTIONS.some((item) => item.key === value)
}
