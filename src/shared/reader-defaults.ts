import type { ReaderPreference } from './reader-types'
import { getReaderThemeOption } from './reader-themes'

const defaultReaderTheme = getReaderThemeOption('eyeCare')

export const DEFAULT_READER_PREFERENCE: ReaderPreference = {
  themeKey: defaultReaderTheme.key,
  fontSize: 18,
  lineHeight: 2.7,
  fontColor: defaultReaderTheme.fontColor,
  backgroundColor: defaultReaderTheme.backgroundColor
}
