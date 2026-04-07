import type { ChapterItem, ParsedDocument } from './reader-types'

interface HeadingPoint {
  level: number
  title: string
}

const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/

export function parseMarkdownDocument(markdown: string, filePath: string): ParsedDocument {
  const lines = markdown.split(/\r?\n/)
  const headings = collectHeadings(lines)

  const documentTitle = extractFileName(filePath).replace(/\.md$/i, '')

  if (headings.length === 0) {
    return {
      documentTitle,
      chapters: [
        {
          id: buildChapterId('全文', 0),
          title: '全文',
          markdown,
          order: 0
        }
      ]
    }
  }

  const splitLevel = detectSplitLevel(headings)
  const chapters: ChapterItem[] = []
  let draftTitle: string | null = null
  let draftLines: string[] = []
  let prefixLines: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(headingPattern)
    const isSplitHeading = Boolean(headingMatch) && headingMatch![1].length === splitLevel

    if (isSplitHeading) {
      if (draftTitle) {
        chapters.push(createChapter(draftTitle, draftLines, chapters.length))
      } else if (hasNarrativePrefix(prefixLines)) {
        chapters.push(createChapter('前言', prefixLines, chapters.length))
      }

      draftTitle = headingMatch![2].trim()
      draftLines = [line]
      prefixLines = []
      continue
    }

    if (!draftTitle) {
      prefixLines.push(line)
      continue
    }

    draftLines.push(line)
  }

  if (draftTitle) {
    chapters.push(createChapter(draftTitle, draftLines, chapters.length))
  }

  if (chapters.length === 0 && prefixLines.length > 0) {
    chapters.push(createChapter('全文', prefixLines, 0))
  }

  return {
    documentTitle,
    chapters
  }
}

function collectHeadings(lines: string[]): HeadingPoint[] {
  const headingPoints: HeadingPoint[] = []

  for (const line of lines) {
    const matched = line.match(headingPattern)
    if (!matched) {
      continue
    }

    headingPoints.push({
      level: matched[1].length,
      title: matched[2].trim()
    })
  }

  return headingPoints
}

function detectSplitLevel(headings: HeadingPoint[]): number {
  const countByLevel = new Map<number, number>()

  for (const heading of headings) {
    countByLevel.set(heading.level, (countByLevel.get(heading.level) ?? 0) + 1)
  }

  const levels = [...countByLevel.keys()].sort((a, b) => a - b)
  const repeatedLevel = levels.find((level) => (countByLevel.get(level) ?? 0) >= 2)

  if (repeatedLevel) {
    return repeatedLevel
  }

  return levels[0]
}

function createChapter(title: string, lines: string[], order: number): ChapterItem {
  return {
    id: buildChapterId(title, order),
    title,
    markdown: lines.join('\n').trim(),
    order
  }
}

function buildChapterId(title: string, index: number): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${index}-${normalizedTitle || 'chapter'}`
}

function extractFileName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const parts = normalizedPath.split('/')
  return parts[parts.length - 1] || 'untitled'
}

function hasNarrativePrefix(lines: string[]): boolean {
  return lines.some((line) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return false
    }

    return !headingPattern.test(trimmed)
  })
}
