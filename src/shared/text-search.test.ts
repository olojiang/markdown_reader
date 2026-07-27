import { describe, expect, it } from 'vitest'

import { searchInText, findChapterIndexAtLine } from './text-search'

describe('searchInText', () => {
  it('returns empty array for empty query', () => {
    expect(searchInText('hello world', '', false, false)).toEqual([])
  })

  it('returns empty array for empty content', () => {
    expect(searchInText('', 'hello', false, false)).toEqual([])
  })

  it('finds plain text matches with correct line and column', () => {
    const content = 'hello world\nfoo bar\nhello again'
    const matches = searchInText(content, 'hello', false, false)

    expect(matches).toHaveLength(2)
    expect(matches[0]).toEqual({
      lineNumber: 1,
      column: 1,
      lineText: 'hello world',
      matchText: 'hello'
    })
    expect(matches[1]).toEqual({
      lineNumber: 3,
      column: 1,
      lineText: 'hello again',
      matchText: 'hello'
    })
  })

  it('finds multiple matches on the same line', () => {
    const content = 'abcabc'
    const matches = searchInText(content, 'abc', false, false)

    expect(matches).toHaveLength(2)
    expect(matches[0].column).toBe(1)
    expect(matches[1].column).toBe(4)
  })

  it('performs case-insensitive search by default', () => {
    const content = 'Hello HELLO hello'
    const matches = searchInText(content, 'hello', false, false)

    expect(matches).toHaveLength(3)
  })

  it('performs case-sensitive search when enabled', () => {
    const content = 'Hello HELLO hello'
    const matches = searchInText(content, 'hello', false, true)

    expect(matches).toHaveLength(1)
    expect(matches[0].column).toBe(13)
  })

  it('supports regex search', () => {
    const content = 'line 123\nline 456\nno numbers here'
    const matches = searchInText(content, '\\d+', true, false)

    expect(matches).toHaveLength(2)
    expect(matches[0].matchText).toBe('123')
    expect(matches[1].matchText).toBe('456')
  })

  it('escapes special regex characters in plain text mode', () => {
    const content = 'price is $100 (USD)'
    const matches = searchInText(content, '$100', false, false)

    expect(matches).toHaveLength(1)
    expect(matches[0].matchText).toBe('$100')
  })

  it('returns empty array for invalid regex', () => {
    const matches = searchInText('hello', '[invalid', true, false)
    expect(matches).toEqual([])
  })

  it('handles zero-length regex matches without infinite loop', () => {
    const content = 'abc'
    const matches = searchInText(content, '(?=a)', true, false)

    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('handles Chinese text search', () => {
    const content = '第一章 江湖初见\n正文内容\n第二章 光明顶'
    const matches = searchInText(content, '第.*章', true, false)

    expect(matches).toHaveLength(2)
    expect(matches[0].matchText).toBe('第一章')
    expect(matches[1].matchText).toBe('第二章')
  })

  it('respects maxResults limit', () => {
    const content = 'aaa\naaa\naaa\naaa\naaa'
    const matches = searchInText(content, 'aaa', false, false, 3)

    expect(matches).toHaveLength(3)
  })

  it('handles Windows CRLF line endings', () => {
    const content = 'line one\r\nline two\r\nline three'
    const matches = searchInText(content, 'line', false, false)

    expect(matches).toHaveLength(3)
    expect(matches[0].lineNumber).toBe(1)
    expect(matches[1].lineNumber).toBe(2)
    expect(matches[2].lineNumber).toBe(3)
  })

  it('finds matches at end of line', () => {
    const content = 'abc def\nghi jkl'
    const matches = searchInText(content, 'def', false, false)

    expect(matches).toHaveLength(1)
    expect(matches[0].column).toBe(5)
  })

  it('handles single-line content', () => {
    const content = 'single line content'
    const matches = searchInText(content, 'line', false, false)

    expect(matches).toHaveLength(1)
    expect(matches[0].lineNumber).toBe(1)
  })
})

describe('findChapterIndexAtLine', () => {
  it('returns 0 for single chapter', () => {
    const chapterTexts = ['line1\nline2\nline3']
    expect(findChapterIndexAtLine(chapterTexts, 1)).toBe(0)
    expect(findChapterIndexAtLine(chapterTexts, 3)).toBe(0)
  })

  it('maps line numbers to correct chapters', () => {
    const chapterTexts = [
      'intro line1\nintro line2',
      '# Chapter 1\nchapter 1 content',
      '# Chapter 2\nchapter 2 content\nextra line'
    ]

    expect(findChapterIndexAtLine(chapterTexts, 1)).toBe(0)
    expect(findChapterIndexAtLine(chapterTexts, 2)).toBe(0)
    expect(findChapterIndexAtLine(chapterTexts, 3)).toBe(1)
    expect(findChapterIndexAtLine(chapterTexts, 4)).toBe(1)
    expect(findChapterIndexAtLine(chapterTexts, 5)).toBe(2)
    expect(findChapterIndexAtLine(chapterTexts, 7)).toBe(2)
  })

  it('returns last chapter for out-of-range line number', () => {
    const chapterTexts = ['line1', 'line2']
    expect(findChapterIndexAtLine(chapterTexts, 999)).toBe(1)
  })

  it('returns 0 for empty chapters array', () => {
    expect(findChapterIndexAtLine([], 1)).toBe(0)
  })
})
