import { appendFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const LOG_FILE_PATTERN = /^reader-debug-\d{4}-\d{2}-\d{2}\.jsonl$/
const MAX_LOG_FILES = 7

export interface ReaderLogger {
  log(event: string, payload?: unknown): Promise<void>
  close(): Promise<void>
}

export function createReaderLogger(logDirectory: string, now: () => Date = () => new Date()): ReaderLogger {
  let queue = Promise.resolve()
  let closed = false

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    queue = queue.then(operation, operation).catch((error: unknown) => {
      console.warn('Failed to write reader log', error)
    })
    return queue
  }

  return {
    log(event, payload) {
      if (closed) {
        return Promise.resolve()
      }

      return enqueue(async () => {
        await mkdir(logDirectory, { recursive: true })
        const fileName = `reader-debug-${formatLocalDate(now())}.jsonl`
        const filePath = join(logDirectory, fileName)
        await appendFile(
          filePath,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            pid: process.pid,
            event,
            payload: payload ?? null
          }) + '\n',
          'utf-8'
        )
        await rotateLogFiles(logDirectory)
      })
    },

    close() {
      return enqueue(async () => {
        closed = true
      })
    }
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function rotateLogFiles(logDirectory: string): Promise<void> {
  const logFiles = (await readdir(logDirectory))
    .filter((fileName) => LOG_FILE_PATTERN.test(fileName))
    .sort()
    .reverse()

  await Promise.all(
    logFiles.slice(MAX_LOG_FILES).map((fileName) => unlink(join(logDirectory, fileName)))
  )
}
