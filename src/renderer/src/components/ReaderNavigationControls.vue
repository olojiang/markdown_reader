<script setup lang="ts">
const props = defineProps<{
  compact: boolean
  canScrollPrevious: boolean
  canScrollNext: boolean
  hasPreviousChapter: boolean
  hasNextChapter: boolean
  chapterProgressText: string
}>()

const emit = defineEmits<{
  'previous-page': []
  'next-page': []
  'previous-chapter': []
  'next-chapter': []
}>()

const pagePreviousLabel = () => (props.compact ? '上一页' : '上一页（Ctrl+↑）')
const pageNextLabel = () => (props.compact ? '下一页' : '下一页（Ctrl+↓）')
const chapterPreviousLabel = () => (props.compact ? '上一章' : '上一章（Ctrl+←）')
const chapterNextLabel = () => (props.compact ? '下一章' : '下一章（Ctrl+→）')
</script>

<template>
  <footer class="md-reader-workspace-navigation-footer">
    <nav class="md-reader-workspace-navigation-nav md-reader-workspace-navigation-nav-page" data-navigation-kind="page" aria-label="阅读翻页">
      <button
        type="button"
        class="md-reader-workspace-navigation-button md-reader-navigation-button-primary"
        data-testid="reader-page-previous"
        data-touch-target="48"
        :disabled="!props.canScrollPrevious"
        @click="emit('previous-page')"
      >
        {{ pagePreviousLabel() }}
      </button>
      <p class="md-reader-workspace-navigation-progress">翻页</p>
      <button
        type="button"
        class="md-reader-workspace-navigation-button md-reader-navigation-button-primary"
        data-testid="reader-page-next"
        data-touch-target="48"
        :disabled="!props.canScrollNext"
        @click="emit('next-page')"
      >
        {{ pageNextLabel() }}
      </button>
    </nav>
    <nav class="md-reader-workspace-navigation-nav md-reader-workspace-navigation-nav-chapter" data-navigation-kind="chapter" aria-label="章节切换">
      <button
        type="button"
        class="md-reader-workspace-navigation-button md-reader-navigation-button-secondary"
        data-testid="reader-chapter-previous"
        data-touch-target="40"
        :disabled="!props.hasPreviousChapter"
        @click="emit('previous-chapter')"
      >
        {{ chapterPreviousLabel() }}
      </button>
      <p class="md-reader-workspace-navigation-progress">{{ props.chapterProgressText }}</p>
      <button
        type="button"
        class="md-reader-workspace-navigation-button md-reader-navigation-button-secondary"
        data-testid="reader-chapter-next"
        data-touch-target="40"
        :disabled="!props.hasNextChapter"
        @click="emit('next-chapter')"
      >
        {{ chapterNextLabel() }}
      </button>
    </nav>
  </footer>
</template>

<style lang="less" scoped>
.md-reader-workspace-navigation-footer {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
  z-index: 9;
  display: grid;
  gap: 6px;
  padding: 8px;
  pointer-events: none;
  border: 1px solid var(--md-stroke);
  border-radius: 14px;
  background: rgba(255, 249, 238, 0.84);
  box-shadow: var(--md-shadow-soft);
  backdrop-filter: blur(12px);
}

.md-reader-workspace-navigation-nav {
  pointer-events: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.md-reader-workspace-navigation-progress {
  min-width: 0;
  margin: 0;
  padding: 5px 9px;
  border-radius: 999px;
  color: var(--md-accent);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  background: rgba(236, 225, 198, 0.72);
}

.md-reader-workspace-navigation-button {
  min-width: 0;
  padding: 0 12px;
  border: 1px solid rgba(140, 122, 87, 0.72);
  border-radius: 10px;
  background: rgba(255, 253, 247, 0.84);
  color: var(--md-text-main);
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
}

.md-reader-navigation-button-primary {
  min-height: 48px;
  background: linear-gradient(180deg, #fffdf7 0%, #f6edd9 100%);
}

.md-reader-navigation-button-secondary {
  min-height: 40px;
  color: var(--md-text-subtle);
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 253, 247, 0.62);
}

.md-reader-workspace-navigation-button:hover:not(:disabled) {
  filter: brightness(1.01);
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(57, 45, 20, 0.16);
}

.md-reader-workspace-navigation-button:active:not(:disabled) {
  transform: translateY(0);
}

.md-reader-workspace-navigation-button:focus-visible {
  outline: none;
  box-shadow: var(--md-focus-ring);
}

.md-reader-workspace-navigation-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

@media (max-width: 900px) {
  .md-reader-workspace-navigation-footer {
    left: 6px;
    right: 6px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 6px);
    padding: 6px 7px;
    border-radius: 12px;
    background: rgba(255, 249, 238, 0.9);
  }

  .md-reader-workspace-navigation-nav {
    gap: 6px;
  }

  .md-reader-workspace-navigation-button {
    padding: 0 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .md-reader-workspace-navigation-button {
    transition: none;
  }
}
</style>
