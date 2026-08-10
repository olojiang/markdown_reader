import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { createReaderStore } from './reader-store'

let tempDir = ''

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = ''
  }
})

describe('reader replacement rule persistence', () => {
  it('persists rules independently for each source file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-replacements-'))
    const store = createReaderStore(join(tempDir, 'reader-store.json'))

    await store.saveReplacementRules('/books/a.md', [{ from: ['甲'], to: 'A' }])
    await store.saveReplacementRules('/books/b.md', [{ from: ['乙'], to: 'B' }])

    expect(await store.loadReplacementRules('/books/a.md')).toEqual([{ from: ['甲'], to: 'A' }])
    expect(await store.loadReplacementRules('/books/b.md')).toEqual([{ from: ['乙'], to: 'B' }])
  })

  it('persists the raw config text even when one line is malformed', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-replacements-'))
    const store = createReaderStore(join(tempDir, 'reader-store.json'))
    const rawText = '甲:乙\n没有分隔符'

    await store.saveReplacementRulesText('/books/a.md', rawText)

    expect(await store.loadReplacementRulesText('/books/a.md')).toBe(rawText)
  })
})
