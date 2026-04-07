import { describe, expect, it } from 'vitest'

import { parseMarkdownDocument } from './markdown-parser'

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
