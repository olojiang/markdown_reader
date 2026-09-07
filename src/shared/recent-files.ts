import type { ReaderRecentFile } from './reader-types'

export const READER_RECENT_FILES_LIMIT = 10

export function stripRecentFileContent(recentFiles: ReaderRecentFile[]): ReaderRecentFile[] {
  return recentFiles.map(({ markdownText: _markdownText, ...file }) => file)
}

export function upsertRecentFile(
  recentFiles: ReaderRecentFile[],
  file: ReaderRecentFile,
  limit = READER_RECENT_FILES_LIMIT
): ReaderRecentFile[] {
  const existing = recentFiles.find((item) => item.sourceKey === file.sourceKey)
  const merged: ReaderRecentFile = {
    ...existing,
    ...file,
    markdownText: file.markdownText ?? existing?.markdownText
  }

  return [merged, ...recentFiles.filter((item) => item.sourceKey !== file.sourceKey)].slice(0, Math.max(limit, 0))
}

export function normalizeRecentFiles(rawValue: unknown, limit = READER_RECENT_FILES_LIMIT): ReaderRecentFile[] {
  if (!Array.isArray(rawValue)) {
    return []
  }

  const normalized: ReaderRecentFile[] = []
  for (const rawItem of rawValue) {
    if (!rawItem || typeof rawItem !== 'object') {
      continue
    }

    const candidate = rawItem as Partial<ReaderRecentFile>
    if (
      (candidate.sourceType !== 'path' && candidate.sourceType !== 'cachedText') ||
      typeof candidate.sourceKey !== 'string' ||
      typeof candidate.sourceLabel !== 'string' ||
      typeof candidate.lastOpenedAt !== 'number' ||
      !Number.isFinite(candidate.lastOpenedAt)
    ) {
      continue
    }

    if (candidate.sourceType === 'path' && (typeof candidate.filePath !== 'string' || candidate.filePath.length === 0)) {
      continue
    }

    normalized.push({
      sourceType: candidate.sourceType,
      sourceKey: candidate.sourceKey,
      sourceLabel: candidate.sourceLabel,
      ...(candidate.filePath ? { filePath: candidate.filePath } : {}),
      ...(typeof candidate.markdownText === 'string' ? { markdownText: candidate.markdownText } : {}),
      lastOpenedAt: candidate.lastOpenedAt
    })
  }

  return normalized
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.sourceKey === item.sourceKey) === index)
    .slice(0, Math.max(limit, 0))
}
