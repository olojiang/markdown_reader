export type VolumePageDirection = -1 | 1

export function getVolumePageDirection(event: Pick<KeyboardEvent, 'key' | 'code'>): VolumePageDirection | null {
  if (event.key === 'AudioVolumeUp' || event.key === 'VolumeUp' || event.code === 'AudioVolumeUp' || event.code === 'VolumeUp') {
    return -1
  }

  if (event.key === 'AudioVolumeDown' || event.key === 'VolumeDown' || event.code === 'AudioVolumeDown' || event.code === 'VolumeDown') {
    return 1
  }

  return null
}
