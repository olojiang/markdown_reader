export type CompactReaderPanel = 'chapters' | 'settings' | null

export interface CompactReaderControlsInput {
  compactLayout: boolean
  hasDocument: boolean
  activePanel: CompactReaderPanel
  controlsVisible: boolean
}

export interface CompactReaderControlsState {
  isCompactLoadedMode: boolean
  isCompactReadingMode: boolean
  showsConfigPanel: boolean
  showChapterPanel: boolean
  showSettingsPanel: boolean
  showTopbar: boolean
  showReadingControls: boolean
  showRevealButton: boolean
  showHiddenNavigation: boolean
}

export function getCompactReaderControlsState(input: CompactReaderControlsInput): CompactReaderControlsState {
  const isCompactLoadedMode = input.compactLayout && input.hasDocument
  const isCompactReadingMode = isCompactLoadedMode && input.activePanel === null

  return {
    isCompactLoadedMode,
    isCompactReadingMode,
    showsConfigPanel: !isCompactReadingMode,
    showChapterPanel: !isCompactLoadedMode || input.activePanel === 'chapters',
    showSettingsPanel: !isCompactLoadedMode || input.activePanel === 'settings',
    showTopbar: isCompactLoadedMode && (input.controlsVisible || input.activePanel !== null),
    showReadingControls: isCompactReadingMode && input.controlsVisible,
    showRevealButton: isCompactReadingMode && !input.controlsVisible,
    showHiddenNavigation: isCompactReadingMode && !input.controlsVisible
  }
}
