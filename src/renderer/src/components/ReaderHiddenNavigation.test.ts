import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReaderHiddenNavigation from './ReaderHiddenNavigation.vue'

describe('ReaderHiddenNavigation', () => {
  it('renders four circular actions with independent page and chapter semantics', () => {
    const wrapper = mount(ReaderHiddenNavigation, {
      props: {
        canScrollPrevious: true,
        canScrollNext: true,
        hasPreviousChapter: true,
        hasNextChapter: true
      }
    })

    expect(wrapper.findAll('[data-testid^="hidden-navigation-"]')).toHaveLength(4)
    expect(wrapper.findAll('.md-reader-hidden-navigation-button')).toHaveLength(4)
    expect(wrapper.findAll('.md-reader-hidden-navigation-button-translucent')).toHaveLength(4)
    expect(wrapper.get('[data-testid="hidden-navigation-page-previous"]').attributes('aria-label')).toBe('上一页')
    expect(wrapper.get('[data-testid="hidden-navigation-page-next"]').attributes('aria-label')).toBe('下一页')
    expect(wrapper.get('[data-testid="hidden-navigation-chapter-previous"]').attributes('aria-label')).toBe('上一章')
    expect(wrapper.get('[data-testid="hidden-navigation-chapter-next"]').attributes('aria-label')).toBe('下一章')
  })

  it('disables only actions that are unavailable at their own boundary', () => {
    const wrapper = mount(ReaderHiddenNavigation, {
      props: {
        canScrollPrevious: false,
        canScrollNext: true,
        hasPreviousChapter: true,
        hasNextChapter: false
      }
    })

    expect(wrapper.get('[data-testid="hidden-navigation-page-previous"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="hidden-navigation-page-next"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="hidden-navigation-chapter-previous"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="hidden-navigation-chapter-next"]').attributes('disabled')).toBeDefined()
  })

  it('emits the action represented by each icon', async () => {
    const wrapper = mount(ReaderHiddenNavigation, {
      props: {
        canScrollPrevious: true,
        canScrollNext: true,
        hasPreviousChapter: true,
        hasNextChapter: true
      }
    })

    await wrapper.get('[data-testid="hidden-navigation-page-previous"]').trigger('click')
    await wrapper.get('[data-testid="hidden-navigation-page-next"]').trigger('click')
    await wrapper.get('[data-testid="hidden-navigation-chapter-previous"]').trigger('click')
    await wrapper.get('[data-testid="hidden-navigation-chapter-next"]').trigger('click')

    expect(wrapper.emitted('previous-page')).toHaveLength(1)
    expect(wrapper.emitted('next-page')).toHaveLength(1)
    expect(wrapper.emitted('previous-chapter')).toHaveLength(1)
    expect(wrapper.emitted('next-chapter')).toHaveLength(1)
  })
})
