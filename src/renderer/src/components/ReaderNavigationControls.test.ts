import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReaderNavigationControls from './ReaderNavigationControls.vue'

describe('ReaderNavigationControls', () => {
  it('keeps page scrolling and chapter switching in separate navigation groups', () => {
    const wrapper = mount(ReaderNavigationControls, {
      props: {
        compact: true,
        canScrollPrevious: true,
        canScrollNext: true,
        hasPreviousChapter: true,
        hasNextChapter: true,
        chapterProgressText: '第 2 / 8 章'
      }
    })

    expect(wrapper.get('[data-navigation-kind="page"]').text()).toContain('翻页')
    expect(wrapper.get('[data-navigation-kind="page"]').text()).not.toContain('章节')
    expect(wrapper.get('[data-navigation-kind="chapter"]').attributes('aria-label')).toBe('章节切换')
    expect(wrapper.get('[data-navigation-kind="chapter"]').text()).toContain('第 2 / 8 章')
  })

  it('uses a larger touch target for page navigation than secondary chapter navigation', () => {
    const wrapper = mount(ReaderNavigationControls, {
      props: {
        compact: true,
        canScrollPrevious: false,
        canScrollNext: true,
        hasPreviousChapter: false,
        hasNextChapter: true,
        chapterProgressText: '第 1 / 8 章'
      }
    })

    expect(wrapper.get('[data-testid="reader-page-next"]').classes()).toContain('md-reader-navigation-button-primary')
    expect(wrapper.get('[data-testid="reader-chapter-next"]').classes()).toContain('md-reader-navigation-button-secondary')
    expect(wrapper.get('[data-testid="reader-page-next"]').attributes('data-touch-target')).toBe('48')
    expect(wrapper.get('[data-testid="reader-chapter-next"]').attributes('data-touch-target')).toBe('40')
  })

  it('disables each navigation direction only at its own boundary', () => {
    const wrapper = mount(ReaderNavigationControls, {
      props: {
        compact: true,
        canScrollPrevious: false,
        canScrollNext: true,
        hasPreviousChapter: true,
        hasNextChapter: false,
        chapterProgressText: '第 8 / 8 章'
      }
    })

    expect(wrapper.get('[data-testid="reader-page-previous"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="reader-page-next"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="reader-chapter-previous"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="reader-chapter-next"]').attributes('disabled')).toBeDefined()
  })

  it('emits the requested action without mixing page and chapter navigation', async () => {
    const wrapper = mount(ReaderNavigationControls, {
      props: {
        compact: false,
        canScrollPrevious: true,
        canScrollNext: true,
        hasPreviousChapter: true,
        hasNextChapter: true,
        chapterProgressText: '第 2 / 8 章'
      }
    })

    await wrapper.get('[data-testid="reader-page-next"]').trigger('click')
    await wrapper.get('[data-testid="reader-chapter-previous"]').trigger('click')

    expect(wrapper.emitted('next-page')).toHaveLength(1)
    expect(wrapper.emitted('previous-chapter')).toHaveLength(1)
    expect(wrapper.emitted('next-chapter')).toBeUndefined()
    expect(wrapper.emitted('previous-page')).toBeUndefined()
  })
})
