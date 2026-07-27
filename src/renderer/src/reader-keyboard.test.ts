import { describe, expect, it } from 'vitest'

import { getVolumePageDirection } from './reader-keyboard'

describe('getVolumePageDirection', () => {
  it('maps Android volume-up key variants to the previous page', () => {
    expect(getVolumePageDirection({ key: 'AudioVolumeUp', code: '' })).toBe(-1)
    expect(getVolumePageDirection({ key: '', code: 'AudioVolumeUp' })).toBe(-1)
    expect(getVolumePageDirection({ key: 'VolumeUp', code: '' })).toBe(-1)
  })

  it('maps Android volume-down key variants to the next page', () => {
    expect(getVolumePageDirection({ key: 'AudioVolumeDown', code: '' })).toBe(1)
    expect(getVolumePageDirection({ key: '', code: 'AudioVolumeDown' })).toBe(1)
    expect(getVolumePageDirection({ key: 'VolumeDown', code: '' })).toBe(1)
  })

  it('ignores unrelated keys', () => {
    expect(getVolumePageDirection({ key: 'ArrowDown', code: 'ArrowDown' })).toBeNull()
  })
})
