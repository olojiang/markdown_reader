import { describe, expect, it } from 'vitest'

import { parseMarkdownDocument, fixChapterOrder } from './markdown-parser'

describe('parseMarkdownDocument', () => {
  it('splits content by level-1 titles and keeps intro section', () => {
    const markdown = [
      '序章内容',
      '',
      '# 第一章 江湖初见',
      '第一章正文',
      '',
      '# 第二章 光明顶',
      '第二章正文'
    ].join('\n')

    const result = parseMarkdownDocument(markdown, '/book/sample.md')

    expect(result.documentTitle).toBe('sample')
    expect(result.chapters).toHaveLength(3)
    expect(result.chapters[0].title).toBe('前言')
    expect(result.chapters[1].title).toBe('第一章 江湖初见')
    expect(result.chapters[2].title).toBe('第二章 光明顶')
  })

  it('falls back to lower heading level if no level-1 titles exist', () => {
    const markdown = [
      '## 卷一',
      '卷一正文',
      '',
      '## 卷二',
      '卷二正文'
    ].join('\n')

    const result = parseMarkdownDocument(markdown, '/book/no-h1.md')

    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].title).toBe('卷一')
    expect(result.chapters[1].title).toBe('卷二')
  })

  it('uses deeper level when only one top-level heading exists', () => {
    const markdown = [
      '# 倚天：重生张无忌',
      '',
      '## 第1章 重生',
      '第一章正文',
      '',
      '## 第2章 下山',
      '第二章正文'
    ].join('\n')

    const result = parseMarkdownDocument(markdown, '/book/novel.md')

    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].title).toBe('第1章 重生')
    expect(result.chapters[1].title).toBe('第2章 下山')
  })

  it('returns one chapter when document has no headings', () => {
    const markdown = '这是一个没有标题的 markdown 文件。'
    const result = parseMarkdownDocument(markdown, '/book/plain.md')

    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].title).toBe('全文')
    expect(result.chapters[0].markdown).toContain('没有标题')
  })
})

describe('fixChapterOrder', () => {
  it('returns original markdown when no chapters exist', () => {
    const markdown = '这是一段没有章节的文本。'
    const result = fixChapterOrder(markdown)

    expect(result.fixedMarkdown).toBe(markdown)
    expect(result.report.isOrdered).toBe(true)
    expect(result.report.totalChapters).toBe(0)
    expect(result.report.fixedCount).toBe(0)
  })

  it('returns original markdown when chapters are already ordered', () => {
    const markdown = [
      '# 透视眼不去赌石，乱看什么呢',
      '',
      '## 第1章 开局',
      '第一章正文',
      '',
      '## 第2章 透视眼',
      '第二章正文',
      '',
      '## 第3章 赌石',
      '第三章正文'
    ].join('\n')

    const result = fixChapterOrder(markdown)

    expect(result.fixedMarkdown).toBe(markdown)
    expect(result.report.isOrdered).toBe(true)
    expect(result.report.totalChapters).toBe(3)
    expect(result.report.fixedCount).toBe(0)
  })

  it('reorders chapters by chapter number', () => {
    const markdown = [
      '# 透视眼不去赌石，乱看什么呢',
      '',
      '## 第3章 赌石',
      '第三章正文',
      '',
      '## 第1章 开局',
      '第一章正文',
      '',
      '## 第2章 透视眼',
      '第二章正文'
    ].join('\n')

    const result = fixChapterOrder(markdown)

    expect(result.report.isOrdered).toBe(false)
    expect(result.report.totalChapters).toBe(3)
    expect(result.report.fixedCount).toBe(3)

    expect(result.fixedMarkdown).toContain('## 第1章 开局')
    expect(result.fixedMarkdown).toContain('## 第2章 透视眼')
    expect(result.fixedMarkdown).toContain('## 第3章 赌石')

    const order1 = result.fixedMarkdown.indexOf('## 第1章 开局')
    const order2 = result.fixedMarkdown.indexOf('## 第2章 透视眼')
    const order3 = result.fixedMarkdown.indexOf('## 第3章 赌石')

    expect(order1).toBeLessThan(order2)
    expect(order2).toBeLessThan(order3)
  })

  it('handles non-sequential chapter numbers', () => {
    const markdown = [
      '## 第112章 玉螭纹笔',
      '内容112',
      '',
      '## 第89章 测试',
      '内容89',
      '',
      '## 第145章 地下室宝库',
      '内容145'
    ].join('\n')

    const result = fixChapterOrder(markdown)

    expect(result.report.isOrdered).toBe(false)
    expect(result.report.totalChapters).toBe(3)

    expect(result.fixedMarkdown).toContain('## 第1章 测试')
    expect(result.fixedMarkdown).toContain('## 第2章 玉螭纹笔')
    expect(result.fixedMarkdown).toContain('## 第3章 地下室宝库')
  })

  it('corrects chapter numbers in titles with extra text', () => {
    const markdown = [
      '## 第3章 玉螭纹笔，1500万！',
      '内容3',
      '',
      '## 第1章 开局',
      '内容1',
      '',
      '## 第2章 透视眼',
      '内容2'
    ].join('\n')

    const result = fixChapterOrder(markdown)

    // items are in sorted order (by chapter number after fix)
    // sorted[0] is chapter 1 "第1章 开局"
    expect(result.report.items[0].chapterNumber).toBe(1)
    expect(result.report.items[0].correctedTitle).toBe('第1章 开局')
    // sorted[2] is chapter 3 "第3章 玉螭纹笔，1500万！" with corrected number 3
    expect(result.report.items[2].chapterNumber).toBe(3)
    expect(result.report.items[2].correctedTitle).toBe('第3章 玉螭纹笔，1500万！')
  })
})
