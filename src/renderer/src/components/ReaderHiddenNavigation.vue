<script setup lang="ts">
defineProps<{
  canScrollPrevious: boolean
  canScrollNext: boolean
  hasPreviousChapter: boolean
  hasNextChapter: boolean
}>()

const emit = defineEmits<{
  'previous-page': []
  'next-page': []
  'previous-chapter': []
  'next-chapter': []
}>()
</script>

<template>
  <nav class="md-reader-hidden-navigation" aria-label="隐藏模式阅读导航">
    <button
      type="button"
      class="md-reader-hidden-navigation-button"
      data-testid="hidden-navigation-page-previous"
      aria-label="上一页"
      title="上一页"
      :disabled="!canScrollPrevious"
      @click="emit('previous-page')"
    >
      <span aria-hidden="true">↑</span>
    </button>
    <button
      type="button"
      class="md-reader-hidden-navigation-button"
      data-testid="hidden-navigation-page-next"
      aria-label="下一页"
      title="下一页"
      :disabled="!canScrollNext"
      @click="emit('next-page')"
    >
      <span aria-hidden="true">↓</span>
    </button>
    <button
      type="button"
      class="md-reader-hidden-navigation-button"
      data-testid="hidden-navigation-chapter-previous"
      aria-label="上一章"
      title="上一章"
      :disabled="!hasPreviousChapter"
      @click="emit('previous-chapter')"
    >
      <span aria-hidden="true">«</span>
    </button>
    <button
      type="button"
      class="md-reader-hidden-navigation-button"
      data-testid="hidden-navigation-chapter-next"
      aria-label="下一章"
      title="下一章"
      :disabled="!hasNextChapter"
      @click="emit('next-chapter')"
    >
      <span aria-hidden="true">»</span>
    </button>
  </nav>
</template>

<style lang="less" scoped>
.md-reader-hidden-navigation {
  position: absolute;
  right: 12px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(2, 48px);
  gap: 8px;
  pointer-events: none;
}

.md-reader-hidden-navigation-button {
  width: 48px;
  height: 48px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(111, 86, 39, 0.42);
  border-radius: 50%;
  background: rgba(255, 249, 238, 0.56);
  color: rgba(31, 27, 20, 0.78);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 4px 14px rgba(57, 45, 20, 0.14);
  backdrop-filter: blur(8px);
  transition: background 160ms ease, transform 160ms ease, opacity 160ms ease;
}

.md-reader-hidden-navigation-button:hover:not(:disabled) {
  background: rgba(255, 249, 238, 0.82);
  transform: translateY(-1px);
}

.md-reader-hidden-navigation-button:active:not(:disabled) {
  transform: translateY(0);
}

.md-reader-hidden-navigation-button:focus-visible {
  outline: none;
  box-shadow: var(--md-focus-ring);
}

.md-reader-hidden-navigation-button:disabled {
  cursor: not-allowed;
  opacity: 0.28;
}

@media (max-width: 900px) {
  .md-reader-hidden-navigation {
    right: 10px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
    grid-template-columns: repeat(2, 48px);
    gap: 7px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .md-reader-hidden-navigation-button {
    transition: none;
  }
}
</style>
