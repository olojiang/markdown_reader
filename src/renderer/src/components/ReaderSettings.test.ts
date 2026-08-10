import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { READER_THEME_OPTIONS } from '@shared/reader-themes'
import type { ReaderPreference } from '@shared/reader-types'

import ReaderSettings from './ReaderSettings.vue'

const preference: ReaderPreference = {
  themeKey: 'day',
  fontSize: 18,
  lineHeight: 1.8,
  contentPadding: 16,
  fontColor: '#111111',
  backgroundColor: '#ffffff'
}

describe('ReaderSettings replacement rules', () => {
  it('exposes per-file replacement rules in the settings entry', async () => {
    const wrapper = mount(ReaderSettings, {
      props: {
        preference,
        themes: READER_THEME_OPTIONS,
        sourceLabel: 'book.md',
        replacementRules: [],
        replacementRulesText: ''
      }
    })

    const textarea = wrapper.get('[data-testid="reader-replacement-rules-input"]')
    expect(textarea.attributes('placeholder')).toContain('From1,From2:To')

    await textarea.setValue('甲，乙:统一名')
    await textarea.trigger('blur')

    expect(wrapper.emitted('replacement-change')?.[0]).toEqual(['甲，乙:统一名'])
  })

  it('keeps the complete multiline draft when parsed rules update from the parent', async () => {
    const wrapper = mount(ReaderSettings, {
      props: {
        preference,
        themes: READER_THEME_OPTIONS,
        sourceLabel: 'book.md',
        replacementRules: [],
        replacementRulesText: ''
      }
    })
    const textarea = wrapper.get('[data-testid="reader-replacement-rules-input"]')

    await textarea.setValue('甲:乙\n丙:丁')
    await wrapper.setProps({ replacementRules: [{ from: ['甲'], to: '乙' }] })

    expect((textarea.element as HTMLTextAreaElement).value).toBe('甲:乙\n丙:丁')
  })

  it('restores malformed raw lines instead of hiding the saved configuration', () => {
    const wrapper = mount(ReaderSettings, {
      props: {
        preference,
        themes: READER_THEME_OPTIONS,
        sourceLabel: 'book.md',
        replacementRules: [{ from: ['甲'], to: '乙' }],
        replacementRulesText: '甲:乙\n没有分隔符'
      }
    })

    expect((wrapper.get('[data-testid="reader-replacement-rules-input"]').element as HTMLTextAreaElement).value).toBe('甲:乙\n没有分隔符')
    expect(wrapper.get('[role="alert"]').text()).toContain('第 2 行')
  })
})
