import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createReaderLogger } from './reader-logger'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('reader logger', () => {
  it('writes durable daily files and keeps only the latest seven days', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'markdown-reader-log-'))
    temporaryDirectories.push(directory)

    let currentDate = new Date(2026, 0, 1, 12)
    const logger = createReaderLogger(directory, () => currentDate)

    for (let index = 0; index < 8; index += 1) {
      await logger.log(`day-${index}`)
      currentDate = new Date(2026, 0, index + 2, 12)
    }
    await logger.close()

    const files = (await readdir(directory)).sort()
    expect(files).toHaveLength(7)
    expect(files[0]).toBe('reader-debug-2026-01-02.jsonl')
    expect(files.at(-1)).toBe('reader-debug-2026-01-08.jsonl')
    expect(await readFile(join(directory, 'reader-debug-2026-01-08.jsonl'), 'utf-8')).toContain('day-7')
  })
})
