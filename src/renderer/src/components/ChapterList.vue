<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import type { ChapterItem } from '@shared/reader-types'

const props = defineProps<{
  chapters: ChapterItem[]
  activeIndex: number
}>()

const emit = defineEmits<{
  select: [index: number]
}>()

const mdReaderChapterListRef = ref<HTMLOListElement | null>(null)

function handleChapterClick(index: number): void {
  emit('select', index)
}

async function scrollActiveChapterIntoView(): Promise<void> {
  await nextTick()

  const list = mdReaderChapterListRef.value
  if (!list) {
    return
  }

  const activeButton = list.querySelector<HTMLButtonElement>(`[data-chapter-index="${props.activeIndex}"]`)
  if (!activeButton) {
    return
  }

  activeButton.scrollIntoView({
    block: 'center',
    behavior: 'auto'
  })
}

onMounted(() => {
  void scrollActiveChapterIntoView()
})
</script>

<template>
  <nav class="md-reader-chapter-nav-wrapper" aria-label="章节导航">
    <h2 class="md-reader-chapter-nav-title">章节</h2>
    <ol ref="mdReaderChapterListRef" class="md-reader-chapter-nav-list">
      <li v-for="(chapter, index) in props.chapters" :key="chapter.id" class="md-reader-chapter-nav-item">
        <button
          type="button"
          class="md-reader-chapter-nav-button"
          :data-chapter-index="index"
          :class="{ 'md-reader-chapter-nav-button-active': index === props.activeIndex }"
          @click="handleChapterClick(index)"
        >
          {{ chapter.title }}
        </button>
      </li>
    </ol>
  </nav>
</template>

<style lang="less" scoped>
.md-reader-chapter-nav-wrapper {
  border: 1px solid #d7c8a9;
  border-radius: 12px;
  padding: 14px;
  background: linear-gradient(180deg, #fffcf5 0%, #fdf6e7 100%);
}

.md-reader-chapter-nav-title {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  color: #3e3321;
}

.md-reader-chapter-nav-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  max-height: min(48vh, 460px);
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.md-reader-chapter-nav-item + .md-reader-chapter-nav-item {
  margin-top: 8px;
}

.md-reader-chapter-nav-button {
  width: 100%;
  text-align: left;
  min-height: 44px;
  border: 1px solid #ddcfb5;
  border-radius: 10px;
  background: #fffaf0;
  color: #2e271a;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.35;
  transition: border-color 140ms ease, background-color 140ms ease, transform 140ms ease;
}

.md-reader-chapter-nav-button-active {
  border-color: #5f4920;
  background: linear-gradient(180deg, #fef5dd 0%, #efdbad 100%);
  box-shadow: inset 0 0 0 1px rgba(95, 73, 32, 0.15);
}

.md-reader-chapter-nav-button:hover {
  border-color: #b8a27d;
  transform: translateY(-1px);
}

.md-reader-chapter-nav-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(107, 82, 32, 0.2);
}

@media (prefers-reduced-motion: reduce) {
  .md-reader-chapter-nav-button {
    transition: none;
  }
}
</style>
