import { describe, expect, it } from 'vitest'

import { getCompactReaderControlsState } from './reader-controls-state'

describe('getCompactReaderControlsState', () => {
  it('shows the reading chrome only for a loaded compact reading view', () => {
    expect(
      getCompactReaderControlsState({
        compactLayout: true,
        hasDocument: true,
        activePanel: null,
        controlsVisible: true
      })
    ).toEqual({
      isCompactLoadedMode: true,
      isCompactReadingMode: true,
      showsConfigPanel: false,
      showChapterPanel: false,
      showSettingsPanel: false,
      showTopbar: true,
      showReadingControls: true,
      showRevealButton: false,
      showHiddenNavigation: false
    })
  })

  it('hides the bottom reading chrome while a compact panel is open', () => {
    const state = getCompactReaderControlsState({
      compactLayout: true,
      hasDocument: true,
      activePanel: 'settings',
      controlsVisible: true
    })

    expect(state.isCompactReadingMode).toBe(false)
    expect(state.showsConfigPanel).toBe(true)
    expect(state.showSettingsPanel).toBe(true)
    expect(state.showTopbar).toBe(true)
    expect(state.showReadingControls).toBe(false)
    expect(state.showRevealButton).toBe(false)
    expect(state.showHiddenNavigation).toBe(false)
  })

  it('keeps a readable recovery button after reading controls are hidden', () => {
    const state = getCompactReaderControlsState({
      compactLayout: true,
      hasDocument: true,
      activePanel: null,
      controlsVisible: false
    })

    expect(state.showReadingControls).toBe(false)
    expect(state.showRevealButton).toBe(true)
    expect(state.showHiddenNavigation).toBe(true)
  })

  it('keeps the full configuration layout when compact mode is unavailable', () => {
    const state = getCompactReaderControlsState({
      compactLayout: false,
      hasDocument: true,
      activePanel: null,
      controlsVisible: true
    })

    expect(state.isCompactLoadedMode).toBe(false)
    expect(state.showsConfigPanel).toBe(true)
    expect(state.showChapterPanel).toBe(true)
    expect(state.showSettingsPanel).toBe(true)
    expect(state.showReadingControls).toBe(false)
    expect(state.showRevealButton).toBe(false)
    expect(state.showHiddenNavigation).toBe(false)
  })
})
