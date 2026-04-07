import { describe, expect, it } from 'vitest'

import { applyReaderTheme, READER_THEME_OPTIONS } from './reader-themes'
import { DEFAULT_READER_PREFERENCE } from './reader-defaults'

describe('reader themes', () => {
  it('provides day/night/eyeCare preset options', () => {
    expect(READER_THEME_OPTIONS.map((item) => item.key)).toEqual(['day', 'night', 'eyeCare'])
  })

  it('applies selected preset colors while keeping typography settings', () => {
    const base = {
      ...DEFAULT_READER_PREFERENCE,
      fontSize: 20,
      lineHeight: 2.2
    }

    const themed = applyReaderTheme(base, 'night')

    expect(themed.themeKey).toBe('night')
    expect(themed.fontSize).toBe(20)
    expect(themed.lineHeight).toBe(2.2)
    expect(themed.fontColor).toBe('#dbe4f2')
    expect(themed.backgroundColor).toBe('#1e2530')
  })
})
