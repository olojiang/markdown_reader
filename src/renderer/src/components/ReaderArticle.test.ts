import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { ChapterItem, ReaderPreference } from '@shared/reader-types'
import ReaderArticle from './ReaderArticle.vue'

const preference: ReaderPreference = {
  themeKey: 'eyeCare',
  fontSize: 19,
  lineHeight: 1.9,
  contentPadding: 14,
  fontColor: '#111111',
  backgroundColor: '#faf3dd'
}

const chapterA: ChapterItem = {
  id: 'chapter-a',
  title: '第一章',
  markdown: '# 第一章\n\n第一章正文',
  order: 0
}

const chapterB: ChapterItem = {
  id: 'chapter-b',
  title: '第二章',
  markdown: '# 第二章\n\n第二章正文',
  order: 1
}

describe('ReaderArticle', () => {
  it('renders only current chapter content', async () => {
    const wrapper = mount(ReaderArticle, {
      props: {
        chapter: chapterA,
        preference
      }
    })

    expect(wrapper.text()).toContain('第一章正文')
    expect(wrapper.text()).not.toContain('第二章正文')
    expect(wrapper.get('[data-testid="md-reader-article-title"]').text()).toBe('第一章')

    await wrapper.setProps({ chapter: chapterB })

    expect(wrapper.text()).toContain('第二章正文')
    expect(wrapper.text()).not.toContain('第一章正文')
    expect(wrapper.get('[data-testid="md-reader-article-title"]').text()).toBe('第二章')
  })

  it('applies reading preference as inline style variables', () => {
    const wrapper = mount(ReaderArticle, {
      props: {
        chapter: chapterA,
        preference
      }
    })

    const article = wrapper.get('[data-testid="md-reader-article-content"]')
    const styleAttr = article.attributes('style')

    expect(styleAttr).toContain('--md-reader-font-size: 19px')
    expect(styleAttr).toContain('--md-reader-line-height: 1.9')
    expect(styleAttr).toContain('--md-reader-content-padding: 14px')
    expect(styleAttr).toContain('--md-reader-font-color: #111111')
    expect(styleAttr).toContain('--md-reader-background-color: #faf3dd')
  })
})
