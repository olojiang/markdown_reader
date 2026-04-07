<script setup lang="ts">
import type { ReaderPreference } from '@shared/reader-types'
import { applyReaderTheme } from '@shared/reader-themes'
import type { ReaderThemeOption } from '@shared/reader-themes'

const props = defineProps<{
  preference: ReaderPreference
  themes: ReaderThemeOption[]
}>()

const emit = defineEmits<{
  change: [value: ReaderPreference]
}>()

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
  </form>
</template>

<style lang="less" scoped>
.md-reader-settings-form {
  margin-top: 0;
}

.md-reader-settings-fieldset {
  margin: 0;
  padding: 14px;
  border: 1px solid #dadada;
  border-radius: 10px;
  background: #ffffff;
}

.md-reader-settings-legend {
  padding: 0 6px;
  font-weight: 600;
}

.md-reader-settings-label {
  display: block;
  margin-top: 10px;
  margin-bottom: 6px;
  font-size: 13px;
}

.md-reader-settings-range-input,
.md-reader-settings-color-input,
.md-reader-settings-select-input {
  width: 100%;
  box-sizing: border-box;
}

.md-reader-settings-select-input {
  min-height: 34px;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  padding: 0 8px;
  background: #ffffff;
}

.md-reader-settings-color-input {
  min-height: 36px;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  padding: 4px;
}
</style>
