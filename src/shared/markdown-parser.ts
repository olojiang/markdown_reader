import type { ChapterItem, ParsedDocument, FixReport, FixResult, ChapterFixItem } from './reader-types'

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

// 章节号提取正则：支持 "1. 第123章" 或 "第123章" 等格式
const chapterNumberPattern = /^(?:\d+[.．、]\s*)?第(\d+)(章|话|节|回|卷|篇|集|部)/

function extractChapterNumber(title: string): number | null {
  const matched = title.match(chapterNumberPattern)
  if (matched) {
    return parseInt(matched[1], 10)
  }
  return null
}

function buildCorrectTitle(title: string, chapterNumber: number): string {
  const matched = title.match(chapterNumberPattern)
  if (matched) {
    return `第${chapterNumber}${matched[2]} ${title.replace(matched[0], '').trim()}`.trim()
  }
  return title
}

export function fixChapterOrder(markdown: string): FixResult {
  const lines = markdown.split(/\r?\n/)
  const headingPoints: { lineIndex: number; level: number; title: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const matched = lines[i].match(headingPattern)
    if (matched) {
      headingPoints.push({
        lineIndex: i,
        level: matched[1].length,
        title: matched[2].trim()
      })
    }
  }

  if (headingPoints.length === 0) {
    return {
      fixedMarkdown: markdown,
      report: {
        isOrdered: true,
        totalChapters: 0,
        fixedCount: 0,
        items: []
      }
    }
  }

  const splitLevel = detectSplitLevel(
    headingPoints.map((h) => ({ level: h.level, title: h.title }))
  )

  const splitHeadings = headingPoints.filter((h) => h.level === splitLevel)

  if (splitHeadings.length === 0) {
    return {
      fixedMarkdown: markdown,
      report: {
        isOrdered: true,
        totalChapters: 0,
        fixedCount: 0,
        items: []
      }
    }
  }

  interface ChapterBlock {
    originalIndex: number
    startLine: number
    endLine: number
    title: string
    chapterNumber: number
    headingLevel: number
  }

  const chapters: ChapterBlock[] = []

  for (let i = 0; i < splitHeadings.length; i++) {
    const h = splitHeadings[i]
    const num = extractChapterNumber(h.title)
    if (num === null) continue

    const startLine = h.lineIndex
    const endLine = i < splitHeadings.length - 1
      ? splitHeadings[i + 1].lineIndex - 1
      : lines.length - 1

    chapters.push({
      originalIndex: chapters.length,
      startLine,
      endLine,
      title: h.title,
      chapterNumber: num,
      headingLevel: h.level
    })
  }

  if (chapters.length === 0) {
    return {
      fixedMarkdown: markdown,
      report: {
        isOrdered: true,
        totalChapters: 0,
        fixedCount: 0,
        items: []
      }
    }
  }

  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)

  // Check if already ordered by comparing original indices
  let isOrdered = true
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].originalIndex !== sorted[i].originalIndex) {
      isOrdered = false
      break
    }
  }

  if (isOrdered) {
    const items: ChapterFixItem[] = chapters.map((c) => ({
      originalIndex: c.originalIndex,
      originalTitle: c.title,
      chapterNumber: c.chapterNumber,
      correctedTitle: c.title
    }))

    return {
      fixedMarkdown: markdown,
      report: {
        isOrdered: true,
        totalChapters: chapters.length,
        fixedCount: 0,
        items
      }
    }
  }

  // Build fixed markdown by reconstructing in sorted order
  const headingPrefix = '#'.repeat(splitLevel)
  const fixedChapterBlocks: string[] = []
  const items: ChapterFixItem[] = []

  for (let i = 0; i < sorted.length; i++) {
    const chapter = sorted[i]
    const correctedTitle = buildCorrectTitle(chapter.title, i + 1)

    items.push({
      originalIndex: chapter.originalIndex,
      originalTitle: chapter.title,
      chapterNumber: i + 1,
      correctedTitle
    })

    fixedChapterBlocks.push(`${headingPrefix} ${correctedTitle}`)
    for (let j = chapter.startLine + 1; j <= chapter.endLine; j++) {
      fixedChapterBlocks.push(lines[j])
    }

    if (i < sorted.length - 1) {
      fixedChapterBlocks.push('')
    }
  }

  const fixedMarkdown = fixedChapterBlocks.join('\n')

  // Count how many chapters moved to a different position
  const fixedCount = sorted.filter((s, i) => s.originalIndex !== i).length

  return {
    fixedMarkdown,
    report: {
      isOrdered: false,
      totalChapters: chapters.length,
      fixedCount,
      items
    }
  }
}
