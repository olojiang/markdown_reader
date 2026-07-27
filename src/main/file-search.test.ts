import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { searchInFolder } from './file-search'

let tempDir = ''

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = ''
  }
})

async function createTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'md-reader-search-'))
  return tempDir
}

describe('searchInFolder', () => {
  it('finds plain text matches in markdown files', async () => {
    const dir = await createTempDir()
    await writeFile(join(dir, 'file1.md'), '第一章 江湖\n正文内容\n第二章 光明顶', 'utf-8')

    const result = await searchInFolder({
      query: '章',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.searchedFiles).toBe(1)
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].lineNumber).toBe(1)
    expect(result.matches[0].matchText).toBe('章')
    expect(result.matches[1].lineNumber).toBe(3)
  })

  it('searches recursively in subdirectories', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, 'sub'), { recursive: true })
    await writeFile(join(dir, 'root.md'), 'hello world', 'utf-8')
    await writeFile(join(dir, 'sub', 'nested.md'), 'hello nested', 'utf-8')

    const result = await searchInFolder({
      query: 'hello',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.searchedFiles).toBe(2)
    expect(result.matches).toHaveLength(2)
  })

  it('excludes specified folders', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, 'include'), { recursive: true })
    await mkdir(join(dir, 'exclude_me'), { recursive: true })
    await writeFile(join(dir, 'include', 'a.md'), 'target', 'utf-8')
    await writeFile(join(dir, 'exclude_me', 'b.md'), 'target', 'utf-8')

    const result = await searchInFolder({
      query: 'target',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: ['exclude_me'],
      maxResults: 100
    })

    expect(result.searchedFiles).toBe(1)
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].filePath).toContain('include')
  })

  it('respects maxResults limit and sets truncated flag', async () => {
    const dir = await createTempDir()
    await writeFile(join(dir, 'big.md'), 'match\nmatch\nmatch\nmatch\nmatch', 'utf-8')

    const result = await searchInFolder({
      query: 'match',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 3
    })

    expect(result.matches).toHaveLength(3)
    expect(result.truncated).toBe(true)
  })

  it('supports regex search', async () => {
    const dir = await createTempDir()
    await writeFile(join(dir, 'data.txt'), 'price: 100\ncount: 200\nname: abc', 'utf-8')

    const result = await searchInFolder({
      query: '\\d{3}',
      isRegex: true,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].matchText).toBe('100')
    expect(result.matches[1].matchText).toBe('200')
  })

  it('skips default ignored directories like node_modules', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(dir, 'app.md'), 'target', 'utf-8')
    await writeFile(join(dir, 'node_modules', 'pkg', 'lib.js'), 'target', 'utf-8')

    const result = await searchInFolder({
      query: 'target',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.searchedFiles).toBe(1)
  })

  it('skips binary-looking files by extension', async () => {
    const dir = await createTempDir()
    await writeFile(join(dir, 'doc.md'), 'findme', 'utf-8')
    await writeFile(join(dir, 'image.png'), 'findme', 'utf-8')

    const result = await searchInFolder({
      query: 'findme',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.searchedFiles).toBe(1)
    expect(result.matches[0].filePath).toContain('doc.md')
  })

  it('returns empty result for non-existent folder', async () => {
    const result = await searchInFolder({
      query: 'hello',
      isRegex: false,
      caseSensitive: false,
      folderPath: '/non/existent/path',
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.matches).toEqual([])
    expect(result.searchedFiles).toBe(0)
  })

  it('searches extensionless known files like Makefile', async () => {
    const dir = await createTempDir()
    await writeFile(join(dir, 'Makefile'), 'target: deps\n\techo build', 'utf-8')

    const result = await searchInFolder({
      query: 'target',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.searchedFiles).toBe(1)
    expect(result.matches).toHaveLength(1)
  })

  it('handles nested exclude folders correctly', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, 'src', 'temp'), { recursive: true })
    await mkdir(join(dir, 'src', 'keep'), { recursive: true })
    await writeFile(join(dir, 'src', 'temp', 'a.md'), 'target', 'utf-8')
    await writeFile(join(dir, 'src', 'keep', 'b.md'), 'target', 'utf-8')

    const result = await searchInFolder({
      query: 'target',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: ['temp'],
      maxResults: 100
    })

    expect(result.searchedFiles).toBe(1)
    expect(result.matches[0].filePath).toContain('keep')
  })

  it('returns matches with relative file paths', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, 'sub'), { recursive: true })
    await writeFile(join(dir, 'sub', 'file.md'), 'target', 'utf-8')

    const result = await searchInFolder({
      query: 'target',
      isRegex: false,
      caseSensitive: false,
      folderPath: dir,
      excludeFolders: [],
      maxResults: 100
    })

    expect(result.matches[0].filePath).toContain(join(dir, 'sub', 'file.md'))
  })
})
