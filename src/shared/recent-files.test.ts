import { describe, expect, it } from 'vitest'

import { normalizeRecentFiles, stripRecentFileContent, upsertRecentFile } from './recent-files'
import type { ReaderRecentFile } from './reader-types'

function recent(sourceKey: string, lastOpenedAt: number): ReaderRecentFile {
  return {
    sourceType: 'cachedText',
    sourceKey,
    sourceLabel: `${sourceKey}.md`,
    markdownText: sourceKey,
    lastOpenedAt
  }
}

describe('recent files', () => {
  it('strips cached document content before persisting mobile metadata', () => {
    const result = stripRecentFileContent([
      {
        ...recent('book', 1),
        markdownText: 'large markdown content'
      }
    ])

    const { markdownText: _markdownText, ...expected } = recent('book', 1)
    expect(result).toEqual([expected])
  })

  it('moves an opened file to the front and keeps its cached text', () => {
    const result = upsertRecentFile([recent('a', 1), recent('b', 2)], {
      ...recent('a', 3),
      markdownText: undefined
    })

    expect(result.map((item) => item.sourceKey)).toEqual(['a', 'b'])
    expect(result[0].markdownText).toBe('a')
  })

  it('keeps only the newest ten unique files', () => {
    const result = normalizeRecentFiles(Array.from({ length: 12 }, (_, index) => recent(String(index), index)))

    expect(result).toHaveLength(10)
    expect(result.map((item) => item.sourceKey)).toEqual(['11', '10', '9', '8', '7', '6', '5', '4', '3', '2'])
  })
})
