import { describe, expect, it } from 'vitest'

import {
  applyReplacementRules,
  parseReplacementRulesText,
  serializeReplacementRules
} from './replacement-rules'

describe('parseReplacementRulesText', () => {
  it('parses English and Chinese comma-separated From values into one To value', () => {
    expect(parseReplacementRulesText('甲,乙，丙:统一名')).toEqual({
      rules: [{ from: ['甲', '乙', '丙'], to: '统一名' }],
      invalidLines: []
    })
  })

  it('ignores blank lines and reports malformed non-empty lines', () => {
    expect(parseReplacementRulesText('甲:乙\n\n没有分隔符')).toEqual({
      rules: [{ from: ['甲'], to: '乙' }],
      invalidLines: [{ lineNumber: 3, text: '没有分隔符' }]
    })
  })
})

describe('applyReplacementRules', () => {
  it('replaces every From literal with the configured unique To literal', () => {
    expect(
      applyReplacementRules('甲乙，甲；A and B', [
        { from: ['甲', '乙'], to: '统一' },
        { from: ['A', 'B'], to: 'letter' }
      ])
    ).toBe('统一统一，统一；letter and letter')
  })
})

describe('serializeReplacementRules', () => {
  it('serializes rules as one editable line per replacement operation', () => {
    expect(serializeReplacementRules([{ from: ['甲', '乙'], to: '统一' }])).toBe('甲,乙:统一')
  })
})
