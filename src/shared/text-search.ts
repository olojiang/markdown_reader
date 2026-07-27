import type { TextSearchMatch } from './search-types'

export function searchInText(
  content: string,
  query: string,
  isRegex: boolean,
  caseSensitive: boolean,
  maxResults?: number
): TextSearchMatch[] {
  if (!query || !content) {
    return []
  }

  let regex: RegExp
  try {
    const pattern = isRegex ? query : escapeRegExp(query)
    const flags = caseSensitive ? 'g' : 'gi'
    regex = new RegExp(pattern, flags)
  } catch {
    return []
  }

  const matches: TextSearchMatch[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    regex.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      matches.push({
        lineNumber: i + 1,
        column: match.index + 1,
        lineText: line,
        matchText: match[0]
      })

      if (maxResults !== undefined && matches.length >= maxResults) {
        return matches
      }

      if (match[0].length === 0) {
        regex.lastIndex++
      }
    }
  }

  return matches
}

/**
 * Maps a 1-based line number to a chapter index (0-based).
 * `chapterTexts` is the ordered list of each chapter's raw markdown content.
 */
export function findChapterIndexAtLine(chapterTexts: string[], lineNumber: number): number {
  if (chapterTexts.length === 0) {
    return 0
  }

  let cumulativeLines = 0

  for (let i = 0; i < chapterTexts.length; i++) {
    const chapterLineCount = chapterTexts[i].split('\n').length
    if (lineNumber <= cumulativeLines + chapterLineCount) {
      return i
    }
    cumulativeLines += chapterLineCount
  }

  return chapterTexts.length - 1
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
