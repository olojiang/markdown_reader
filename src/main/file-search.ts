import { readdir, readFile, stat } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

import type { FileSearchMatch, FileSearchResult, FolderSearchRequest } from '../shared/search-types'
import { searchInText } from '../shared/text-search'

const ALWAYS_SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'out', 'build', '.next', '.nuxt',
  '__pycache__', '.DS_Store', '.cache', '.vscode'
])

const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.text',
  '.json', '.jsonl', '.json5',
  '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts',
  '.jsx', '.tsx',
  '.css', '.less', '.scss', '.sass',
  '.html', '.htm', '.xml', '.svg',
  '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
  '.vue', '.svelte', '.astro',
  '.sh', '.bash', '.zsh', '.fish',
  '.py', '.rb', '.rs', '.go', '.java', '.kt', '.c', '.cpp', '.h',
  '.env', '.gitignore', '.editorconfig',
  '.csv', '.tsv', '.log'
])

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const MAX_FILES_TO_SCAN = 5000

export async function searchInFolder(request: FolderSearchRequest): Promise<FileSearchResult> {
  const matches: FileSearchMatch[] = []
  let searchedFiles = 0
  let truncated = false

  const excludeSet = new Set(request.excludeFolders.map((f) => f.trim()).filter(Boolean))

  try {
    const filePaths = await collectTextFiles(request.folderPath, excludeSet)

    for (const filePath of filePaths) {
      if (truncated) {
        break
      }

      const remaining = request.maxResults - matches.length
      if (remaining <= 0) {
        truncated = true
        break
      }

      try {
        const content = await readFile(filePath, 'utf-8')
        const fileMatches = searchInText(content, request.query, request.isRegex, request.caseSensitive, remaining)

        for (const match of fileMatches) {
          matches.push({
            ...match,
            filePath
          })
        }

        searchedFiles++

        if (matches.length >= request.maxResults) {
          truncated = true
        }
      } catch {
        // Skip unreadable files (permission errors, encoding issues, etc.)
      }
    }
  } catch {
    // Folder access error — return empty result
  }

  return { matches, searchedFiles, truncated }
}

async function collectTextFiles(dirPath: string, excludeFolders: Set<string>): Promise<string[]> {
  const files: string[] = []

  async function walk(currentPath: string): Promise<void> {
    if (files.length >= MAX_FILES_TO_SCAN) {
      return
    }

    let entries
    try {
      entries = await readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES_TO_SCAN) {
        return
      }

      const entryName = entry.name

      if (entry.isDirectory()) {
        if (ALWAYS_SKIP_DIRS.has(entryName) || excludeFolders.has(entryName)) {
          continue
        }
        await walk(join(currentPath, entryName))
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (!isTextFileExtension(entryName)) {
        continue
      }

      const fullPath = join(currentPath, entryName)
      try {
        const fileStat = await stat(fullPath)
        if (fileStat.size > MAX_FILE_SIZE_BYTES) {
          continue
        }
      } catch {
        continue
      }

      files.push(fullPath)
    }
  }

  await walk(dirPath)
  return files
}

function isTextFileExtension(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) {
    return true
  }

  const name = basename(filename)
  return name === 'Makefile' || name === 'Dockerfile' || name === 'LICENSE' || name === 'README'
}
