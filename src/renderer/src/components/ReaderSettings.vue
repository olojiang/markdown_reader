<script setup lang="ts">
import { ref, watch } from 'vue'

import type { ReaderPreference } from '@shared/reader-types'
import { applyReaderTheme } from '@shared/reader-themes'
import type { ReaderThemeOption } from '@shared/reader-themes'
import { parseReplacementRulesText, serializeReplacementRules, type ReplacementRule } from '@shared/replacement-rules'

const props = defineProps<{
  preference: ReaderPreference
  themes: ReaderThemeOption[]
  sourceLabel?: string
  replacementRules: ReplacementRule[]
  replacementRulesText: string
}>()

const emit = defineEmits<{
  change: [value: ReaderPreference]
  'replacement-input': [value: string]
  'replacement-change': [value: string]
}>()

const replacementRulesText = ref(props.replacementRulesText || serializeReplacementRules(props.replacementRules))
const replacementRulesError = ref(formatReplacementRulesError(replacementRulesText.value))

watch(
  () => props.replacementRulesText,
  (value) => {
    if (value !== replacementRulesText.value) {
      replacementRulesText.value = value
      replacementRulesError.value = formatReplacementRulesError(value)
    }
  },
)

function updatePreference(patch: Partial<ReaderPreference>): void {
  emit('change', {
    ...props.preference,
    ...patch
  })
}

function updateTheme(themeKey: string): void {
  const selectedTheme = props.themes.find((item) => item.key === themeKey)
  if (!selectedTheme) {
    return
  }

  emit('change', applyReaderTheme(props.preference, selectedTheme.key))
}

function updateReplacementRules(text: string): void {
  replacementRulesText.value = text
  emit('replacement-input', text)
  replacementRulesError.value = formatReplacementRulesError(text)
}

function commitReplacementRules(): void {
  emit('replacement-change', replacementRulesText.value)
}

function formatReplacementRulesError(text: string): string {
  const invalidLines = parseReplacementRulesText(text).invalidLines
  if (invalidLines.length === 0) {
    return ''
  }

  return `第 ${invalidLines.map((line) => line.lineNumber).join('、')} 行格式无效，请使用 From1,From2:To`
}
</script>

<template>
  <form class="md-reader-settings-form" aria-label="阅读设置" @submit.prevent>
    <fieldset class="md-reader-settings-fieldset">
      <legend class="md-reader-settings-legend">阅读样式</legend>

      <label class="md-reader-settings-label" for="md-reader-theme-select-input">主题</label>
      <select
        id="md-reader-theme-select-input"
        class="md-reader-settings-select-input"
        :value="preference.themeKey"
        @change="updateTheme(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="theme in props.themes" :key="theme.key" :value="theme.key">
          {{ theme.label }}
        </option>
      </select>

      <label class="md-reader-settings-label" for="md-reader-font-size-input">
        字号：{{ preference.fontSize }}px
      </label>
      <input
        id="md-reader-font-size-input"
        class="md-reader-settings-range-input"
        type="range"
        min="14"
        max="40"
        step="1"
        :value="preference.fontSize"
        @input="updatePreference({ fontSize: Number(($event.target as HTMLInputElement).value) })"
      />

      <label class="md-reader-settings-label" for="md-reader-line-height-input">
        行间距：{{ preference.lineHeight.toFixed(2) }}
      </label>
      <input
        id="md-reader-line-height-input"
        class="md-reader-settings-range-input"
        type="range"
        min="1.2"
        max="2.8"
        step="0.05"
        :value="preference.lineHeight"
        @input="updatePreference({ lineHeight: Number(($event.target as HTMLInputElement).value) })"
      />

      <label class="md-reader-settings-label" for="md-reader-content-padding-input">
        边距：{{ preference.contentPadding }}px
      </label>
      <input
        id="md-reader-content-padding-input"
        class="md-reader-settings-range-input"
        type="range"
        min="8"
        max="40"
        step="1"
        :value="preference.contentPadding"
        @input="updatePreference({ contentPadding: Number(($event.target as HTMLInputElement).value) })"
      />

      <label class="md-reader-settings-label" for="md-reader-font-color-input">字体颜色</label>
      <input
        id="md-reader-font-color-input"
        class="md-reader-settings-color-input"
        type="color"
        :value="preference.fontColor"
        @input="updatePreference({ fontColor: ($event.target as HTMLInputElement).value })"
      />

      <label class="md-reader-settings-label" for="md-reader-background-color-input">背景颜色</label>
      <input
        id="md-reader-background-color-input"
        class="md-reader-settings-color-input"
        type="color"
        :value="preference.backgroundColor"
        @input="updatePreference({ backgroundColor: ($event.target as HTMLInputElement).value })"
      />
    </fieldset>

    <fieldset class="md-reader-settings-fieldset md-reader-replacement-settings-fieldset">
      <legend class="md-reader-settings-legend">当前文件替换</legend>
      <p v-if="sourceLabel" class="md-reader-settings-help-text">仅对当前文件生效：{{ sourceLabel }}</p>
      <p v-else class="md-reader-settings-help-text">请先打开文件，再配置当前文件的替换。</p>
      <label class="md-reader-settings-label" for="reader-replacement-rules-input">替换规则</label>
      <textarea
        id="reader-replacement-rules-input"
        data-testid="reader-replacement-rules-input"
        class="md-reader-settings-textarea-input"
        :value="replacementRulesText"
        :disabled="!sourceLabel"
        placeholder="From1,From2:To\n每行一条规则"
        rows="6"
        spellcheck="false"
        @input="updateReplacementRules(($event.target as HTMLTextAreaElement).value)"
        @blur="commitReplacementRules"
      ></textarea>
      <p v-if="replacementRulesError" class="md-reader-settings-error-text" role="alert">{{ replacementRulesError }}</p>
      <p class="md-reader-settings-help-text">支持中文或英文逗号；替换发生在每章 Markdown 渲染之前。</p>
    </fieldset>
  </form>
</template>

<style lang="less" scoped>
.md-reader-settings-form {
  margin-top: 0;
}

.md-reader-settings-fieldset {
  margin: 0;
  padding: 14px;
  border: 1px solid #d7c8a9;
  border-radius: 12px;
  background: linear-gradient(180deg, #fffcf5 0%, #fdf6e7 100%);
}

.md-reader-replacement-settings-fieldset {
  margin-top: 12px;
}

.md-reader-settings-legend {
  padding: 0 6px;
  font-weight: 600;
  color: #3b301f;
}

.md-reader-settings-label {
  display: block;
  margin-top: 10px;
  margin-bottom: 6px;
  font-size: 13px;
  color: #4f452f;
}

.md-reader-settings-help-text,
.md-reader-settings-error-text {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.md-reader-settings-help-text {
  color: #665b46;
}

.md-reader-settings-error-text {
  color: #a23d2d;
}

.md-reader-settings-range-input,
.md-reader-settings-color-input,
.md-reader-settings-select-input,
.md-reader-settings-textarea-input {
  width: 100%;
  box-sizing: border-box;
}

.md-reader-settings-textarea-input {
  min-height: 108px;
  resize: vertical;
  border: 1px solid #d8c9ad;
  border-radius: 10px;
  padding: 8px;
  background: #ffffff;
  color: #2d261a;
  font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.md-reader-settings-select-input {
  min-height: 38px;
  border: 1px solid #d8c9ad;
  border-radius: 10px;
  padding: 0 8px;
  background: #ffffff;
  color: #2d261a;
}

.md-reader-settings-color-input {
  min-height: 40px;
  border: 1px solid #d8c9ad;
  border-radius: 10px;
  padding: 4px;
}

.md-reader-settings-range-input {
  accent-color: #775b28;
  min-height: 30px;
}

.md-reader-settings-select-input:focus-visible,
.md-reader-settings-color-input:focus-visible,
.md-reader-settings-range-input:focus-visible,
.md-reader-settings-textarea-input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(107, 82, 32, 0.2);
}
</style>
