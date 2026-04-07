import type { ReaderPreference, ReaderThemeKey } from './reader-types'

export interface ReaderThemeOption {
  key: ReaderThemeKey
  label: string
  fontColor: string
  backgroundColor: string
}

export const READER_THEME_OPTIONS: ReaderThemeOption[] = [
  {
    key: 'day',
    label: '白天',
    fontColor: '#1f1f1f',
    backgroundColor: '#fffdf8'
  },
  {
    key: 'night',
    label: '夜晚',
    fontColor: '#dbe4f2',
    backgroundColor: '#1e2530'
  },
  {
    key: 'eyeCare',
    label: '护眼',
    fontColor: '#2f3a25',
    backgroundColor: '#dce8c8'
  }
]

const READER_THEME_MAP = new Map<ReaderThemeKey, ReaderThemeOption>(
  READER_THEME_OPTIONS.map((item) => [item.key, item])
)

export function getReaderThemeOption(themeKey: ReaderThemeKey): ReaderThemeOption {
  return READER_THEME_MAP.get(themeKey) ?? READER_THEME_OPTIONS[2]
}

export function applyReaderTheme(preference: ReaderPreference, themeKey: ReaderThemeKey): ReaderPreference {
  const theme = getReaderThemeOption(themeKey)

  return {
    ...preference,
    themeKey,
    fontColor: theme.fontColor,
    backgroundColor: theme.backgroundColor
  }
}
