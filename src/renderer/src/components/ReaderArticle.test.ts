import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ChapterItem, ReaderPreference } from '@shared/reader-types'
import type { ReplacementRule } from '@shared/replacement-rules'
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
    expect(wrapper.get('[data-testid="md-reader-article-content"]').html()).not.toContain('<h1>')

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

  it('applies the current file replacement rules before markdown rendering', () => {
    const replacementRules: ReplacementRule[] = [
      { from: ['第一章正文', '正文'], to: '替换后' },
      { from: ['第一章'], to: '替换章节' }
    ]
    const wrapper = mount(ReaderArticle, {
      props: {
        chapter: chapterA,
        preference,
        replacementRules
      }
    })

    expect(wrapper.text()).toContain('替换后')
    expect(wrapper.text()).not.toContain('第一章正文')
    expect(wrapper.get('[data-testid="md-reader-article-title"]').text()).toBe('替换章节')
  })

  it('keeps two lines of overlap and completes page scrolling in 160ms', async () => {
    const wrapper = mount(ReaderArticle, {
      props: {
        chapter: chapterA,
        preference
      }
    })
    const article = wrapper.get('[data-testid="md-reader-article-content"]').element as HTMLElement
    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      article.scrollTop = top ?? 0
    })

    Object.defineProperties(article, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 350 },
      scrollTo: { configurable: true, value: scrollTo }
    })

    const frameCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    wrapper.vm.scrollByPage(1)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    frameCallbacks.shift()?.(0)
    frameCallbacks.shift()?.(160)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 28, behavior: 'auto' })

    wrapper.vm.scrollByPage(1)
    frameCallbacks.shift()?.(0)
    frameCallbacks.shift()?.(160)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 56, behavior: 'auto' })

    wrapper.vm.scrollByPage(-1)
    frameCallbacks.shift()?.(0)
    frameCallbacks.shift()?.(160)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 28, behavior: 'auto' })

    requestAnimationFrame.mockRestore()
    cancelAnimationFrame.mockRestore()
  })
})
