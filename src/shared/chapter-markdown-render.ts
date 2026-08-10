const atxHeadingLinePattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/

import { applyReplacementRules, type ReplacementRule } from './replacement-rules'

// 仅由 3 个及以上相同分隔符字符（可含空格）组成的行，例如
// ---、===、~~~~~~~~~~~~~~~~~~~~、* * *。小说用这些线做场景分隔，
// 但 Markdown 会把 === 当成 Setext 一级标题、把 ~~~ 当成代码围栏，
// 导致整章正文变成大字或代码块，这里统一归一化为 --- 水平线。
const separatorLinePattern = /^(?:([-=*~_])(?:\s*\1){2,})\s*$/

export function stripLeadingChapterHeading(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  if (lines.length === 0 || !atxHeadingLinePattern.test(lines[0].trim())) {
    return markdown
  }

  let start = 1
  while (start < lines.length && lines[start].trim() === '') {
    start += 1
  }

  return lines.slice(start).join('\n').trim()
}

export function normalizeSeparatorLines(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => (separatorLinePattern.test(line.trim()) ? '---' : line))
    .join('\n')
}

// 章节正文里残留的 ATX 标题（多是串进本章的下一章标题，如 `## 2. 第2章 标题`）
// 会被 Markdown 渲染成大字标题。这里去掉 `#` 标记降级为普通段落，并用空行
// 包成独立段落，避免和相邻正文因 breaks 合并到同一段。
export function demoteBodyHeadingsToParagraphs(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const out: string[] = []

  for (const line of lines) {
    const matched = line.match(atxHeadingLinePattern)
    if (!matched) {
      out.push(line)
      continue
    }

    if (out.length > 0 && out[out.length - 1] !== '') {
      out.push('')
    }
    out.push(matched[2].trim())
    out.push('')
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function prepareChapterMarkdownForRender(markdown: string, replacementRules: ReplacementRule[] = []): string {
  return demoteBodyHeadingsToParagraphs(
    normalizeSeparatorLines(stripLeadingChapterHeading(applyReplacementRules(markdown, replacementRules)))
  )
}
