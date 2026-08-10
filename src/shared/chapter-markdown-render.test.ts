import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'

import { demoteBodyHeadingsToParagraphs, normalizeSeparatorLines, prepareChapterMarkdownForRender, stripLeadingChapterHeading } from './chapter-markdown-render'

function createReaderMarkdownParser() {
  const parser = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true
  })

  parser.disable('lheading')
  return parser
}

describe('stripLeadingChapterHeading', () => {
  it('removes the first ATX heading and following blank lines', () => {
    const markdown = ['## 第245章 这消息很劲爆吗？', '', '正文第一段', '正文第二段'].join('\n')

    expect(stripLeadingChapterHeading(markdown)).toBe(['正文第一段', '正文第二段'].join('\n'))
  })

  it('keeps markdown unchanged when the first line is not a heading', () => {
    const markdown = '纯文本开头\n第二行'

    expect(stripLeadingChapterHeading(markdown)).toBe(markdown)
  })
})

describe('prepareChapterMarkdownForRender', () => {
  it('prevents dash separator lines from turning body text into headings', () => {
    const parser = createReaderMarkdownParser()
    const markdown = prepareChapterMarkdownForRender(
      [
        '## 246. 第245章 这消息很劲爆吗？',
        '',
        '“什么？许默那家伙过几天就要结婚了？”',
        '林凡表情愕然，很快转变为愤怒。',
        '马群纠结得鸭皮。',
        '------------------------------',
        '今天提前发了，晚上还有一张'
      ].join('\n')
    )

    const html = parser.render(markdown)

    expect(html).not.toMatch(/<h[1-6]>/)
    expect(html).toContain('<p>“什么？许默那家伙过几天就要结婚了？”')
    expect(html).toContain('<hr>')
  })

  it('keeps an equals-underline separator from turning body text into an h1', () => {
    const parser = createReaderMarkdownParser()
    const markdown = prepareChapterMarkdownForRender(
      [
        '## 第10章 标题',
        '',
        '第一段正文。',
        '==============================',
        '第二段正文。'
      ].join('\n')
    )

    const html = parser.render(markdown)

    expect(html).not.toMatch(/<h[1-6]>/)
    expect(html).toContain('<p>第一段正文。</p>')
    expect(html).toContain('<p>第二段正文。</p>')
    expect(html).toContain('<hr>')
  })

  it('keeps a tilde separator from swallowing the rest of the chapter as a code block', () => {
    const parser = createReaderMarkdownParser()
    const markdown = prepareChapterMarkdownForRender(
      [
        '## 第1章 标题',
        '',
        '第一段正文。',
        '~~~~~~~~~~~~~~~~~~~~',
        '第二段正文。'
      ].join('\n')
    )

    const html = parser.render(markdown)

    expect(html).not.toMatch(/<h[1-6]>/)
    expect(html).not.toContain('<pre')
    expect(html).not.toContain('<code')
    expect(html).toContain('<p>第一段正文。</p>')
    expect(html).toContain('<p>第二段正文。</p>')
    expect(html).toContain('<hr>')
  })

  it('does not turn a whole chapter body of dash-separated paragraphs into headings', () => {
    const parser = createReaderMarkdownParser()
    const markdown = prepareChapterMarkdownForRender(
      [
        '## 第88章 大字章节',
        '',
        '段落一。',
        '---',
        '段落二。',
        '---',
        '段落三。'
      ].join('\n')
    )

    const html = parser.render(markdown)

    expect(html).not.toMatch(/<h[1-6]>/)
    expect(html).toContain('段落一。')
    expect(html).toContain('段落二。')
    expect(html).toContain('段落三。')
  })
})

describe('normalizeSeparatorLines', () => {
  it('rewrites equals, tilde and spaced separators into horizontal rules', () => {
    const markdown = ['正文一', '======', '正文二', '~~~~~~', '正文三', '* * *', '正文四'].join('\n')

    expect(normalizeSeparatorLines(markdown).split('\n')).toEqual([
      '正文一',
      '---',
      '正文二',
      '---',
      '正文三',
      '---',
      '正文四'
    ])
  })

  it('leaves normal text and dotted lines untouched', () => {
    const markdown = ['第一段。', '......', '第二段。'].join('\n')

    expect(normalizeSeparatorLines(markdown)).toBe(markdown)
  })
})

describe('demoteBodyHeadingsToParagraphs', () => {
  it('strips hash markers so a stray chapter heading renders as a plain paragraph', () => {
    const markdown = ['第一段正文。', '## 2. 第2章 串进来的标题', '第二段正文。'].join('\n')

    expect(demoteBodyHeadingsToParagraphs(markdown)).toBe(
      ['第一段正文。', '', '2. 第2章 串进来的标题', '', '第二段正文。'].join('\n')
    )
  })

  it('keeps each demoted heading as its own paragraph instead of merging with neighbors', () => {
    const parser = createReaderMarkdownParser()
    const html = parser.render(demoteBodyHeadingsToParagraphs('前文。\n## 标题\n后文。'))

    expect(html).not.toMatch(/<h[1-6]>/)
    expect(html).toContain('<p>前文。</p>')
    expect(html).toContain('<p>标题</p>')
    expect(html).toContain('<p>后文。</p>')
  })

  it('leaves non-heading lines untouched', () => {
    const markdown = '普通正文\n> 不是标题'

    expect(demoteBodyHeadingsToParagraphs(markdown)).toBe(markdown)
  })
})

describe('prepareChapterMarkdownForRender (body headings)', () => {
  it('demotes a hash-prefixed body line to a paragraph while keeping the chapter title stripped', () => {
    const parser = createReaderMarkdownParser()
    const markdown = prepareChapterMarkdownForRender(
      ['## 第1章 本章标题', '', '正文开头。', '# 各界大佬喊话唐梦星', '正文继续。'].join('\n')
    )

    const html = parser.render(markdown)

    expect(html).not.toMatch(/<h[1-6]>/)
    expect(html).not.toContain('本章标题')
    expect(html).toContain('<p>正文开头。</p>')
    expect(html).toContain('<p>各界大佬喊话唐梦星</p>')
    expect(html).toContain('<p>正文继续。</p>')
  })
})
