import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_READER_PREFERENCE, createReaderStore } from './reader-store'

let tempDir = ''

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = ''
  }
})

describe('createReaderStore', () => {
  it('persists and reloads reading position by file path', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-store-'))
    const store = createReaderStore(join(tempDir, 'reader-store.json'))

    await store.savePosition('/book/a.md', { chapterIndex: 5, scrollTop: 1280 })

    const position = await store.loadPosition('/book/a.md')
    expect(position).toEqual({ chapterIndex: 5, scrollTop: 1280 })
  })

  it('returns default preference before user customization', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-store-'))
    const store = createReaderStore(join(tempDir, 'reader-store.json'))

    const preference = await store.loadPreference()
    expect(preference).toEqual(DEFAULT_READER_PREFERENCE)
  })

  it('persists customized preference', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-store-'))
    const store = createReaderStore(join(tempDir, 'reader-store.json'))

    const changedPreference = {
      themeKey: 'night' as const,
      fontSize: 20,
      lineHeight: 2,
      contentPadding: 12,
      fontColor: '#222222',
      backgroundColor: '#efe8d8'
    }

    await store.savePreference(changedPreference)

    const preference = await store.loadPreference()
    expect(preference).toEqual(changedPreference)
  })

  it('migrates legacy preference without themeKey to day theme', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-store-'))
    const storagePath = join(tempDir, 'reader-store.json')

    await writeFile(
      storagePath,
      JSON.stringify({
        positions: {},
        preference: {
          fontSize: 19,
          lineHeight: 2.1,
          fontColor: '#1f1f1f',
          backgroundColor: '#f8f3e8'
        }
      }),
      'utf-8'
    )

    const store = createReaderStore(storagePath)
    const preference = await store.loadPreference()

    expect(preference.themeKey).toBe('day')
    expect(preference.fontColor).toBe('#1f1f1f')
    expect(preference.backgroundColor).toBe('#f8f3e8')
    expect(preference.contentPadding).toBe(DEFAULT_READER_PREFERENCE.contentPadding)
  })

  it('repairs historical eyeCare mismatch color pair on load', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-store-'))
    const storagePath = join(tempDir, 'reader-store.json')

    await writeFile(
      storagePath,
      JSON.stringify({
        positions: {},
        preference: {
          themeKey: 'eyeCare',
          fontSize: 18,
          lineHeight: 2.7,
          fontColor: '#1f1f1f',
          backgroundColor: '#f8f3e8'
        }
      }),
      'utf-8'
    )

    const store = createReaderStore(storagePath)
    const preference = await store.loadPreference()

    expect(preference.themeKey).toBe('eyeCare')
    expect(preference.fontColor).toBe('#2f3a25')
    expect(preference.backgroundColor).toBe('#dce8c8')
    expect(preference.contentPadding).toBe(DEFAULT_READER_PREFERENCE.contentPadding)
  })

  it('persists and reloads last opened session', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-store-'))
    const store = createReaderStore(join(tempDir, 'reader-store.json'))

    await store.saveLastOpenedSession({
      sourceType: 'path',
      sourceKey: '/book/a.md',
      sourceLabel: 'a.md',
      filePath: '/book/a.md'
    })

    const value = await store.loadLastOpenedSession()
    expect(value).toEqual({
      sourceType: 'path',
      sourceKey: '/book/a.md',
      sourceLabel: 'a.md',
      filePath: '/book/a.md'
    })
  })

  it('ignores invalid last opened session structure', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reader-store-'))
    const storagePath = join(tempDir, 'reader-store.json')

    await writeFile(
      storagePath,
      JSON.stringify({
        positions: {},
        preference: DEFAULT_READER_PREFERENCE,
        lastOpenedSession: {
          sourceType: 'path',
          sourceKey: '/book/a.md',
          sourceLabel: 'a.md'
        }
      }),
      'utf-8'
    )

    const store = createReaderStore(storagePath)
    const value = await store.loadLastOpenedSession()
    expect(value).toBeNull()
  })
})
