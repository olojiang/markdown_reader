export interface ReplacementRule {
  from: string[]
  to: string
}

export interface InvalidReplacementRuleLine {
  lineNumber: number
  text: string
}

export interface ReplacementRulesParseResult {
  rules: ReplacementRule[]
  invalidLines: InvalidReplacementRuleLine[]
}

export function parseReplacementRulesText(text: string): ReplacementRulesParseResult {
  const rules: ReplacementRule[] = []
  const invalidLines: InvalidReplacementRuleLine[] = []

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) {
      return
    }

    const separatorIndex = line.search(/[:：]/)
    if (separatorIndex < 0) {
      invalidLines.push({ lineNumber: index + 1, text: line })
      return
    }

    const from = uniqueNonEmptyValues(line.slice(0, separatorIndex).split(/[,，]/))
    const to = line.slice(separatorIndex + 1).trim()
    if (from.length === 0 || !to) {
      invalidLines.push({ lineNumber: index + 1, text: line })
      return
    }

    rules.push({ from, to })
  })

  return { rules, invalidLines }
}

export function serializeReplacementRules(rules: ReplacementRule[]): string {
  return normalizeReplacementRules(rules)
    .map((rule) => `${rule.from.join(',')}:${rule.to}`)
    .join('\n')
}

export function applyReplacementRules(markdown: string, rules: ReplacementRule[]): string {
  return normalizeReplacementRules(rules).reduce((result, rule) => {
    return rule.from.reduce((current, from) => current.split(from).join(rule.to), result)
  }, markdown)
}

export function normalizeReplacementRules(raw: unknown): ReplacementRule[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const candidate = item as Partial<ReplacementRule>
    const from = Array.isArray(candidate.from) ? uniqueNonEmptyValues(candidate.from) : []
    const to = typeof candidate.to === 'string' ? candidate.to.trim() : ''
    return from.length > 0 && to ? [{ from, to }] : []
  })
}

function uniqueNonEmptyValues(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
}
