<script setup lang="ts">
import type { ChapterItem } from '@shared/reader-types'

const props = defineProps<{
  chapters: ChapterItem[]
  activeIndex: number
}>()

const emit = defineEmits<{
  select: [index: number]
}>()

function handleChapterClick(index: number): void {
  emit('select', index)
}
</script>

<template>
  <nav class="md-reader-chapter-nav-wrapper" aria-label="章节导航">
    <h2 class="md-reader-chapter-nav-title">章节</h2>
    <ol class="md-reader-chapter-nav-list">
      <li v-for="(chapter, index) in props.chapters" :key="chapter.id" class="md-reader-chapter-nav-item">
        <button
          type="button"
          class="md-reader-chapter-nav-button"
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
  border: 1px solid #dadada;
  border-radius: 10px;
  padding: 14px;
  background: #ffffff;
}

.md-reader-chapter-nav-title {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
}

.md-reader-chapter-nav-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  max-height: 320px;
  overflow-y: auto;
}

.md-reader-chapter-nav-item + .md-reader-chapter-nav-item {
  margin-top: 8px;
}

.md-reader-chapter-nav-button {
  width: 100%;
  text-align: left;
  border: 1px solid #dadada;
  border-radius: 8px;
  background: #f6f6f6;
  color: #1f1f1f;
  padding: 8px 10px;
  cursor: pointer;
}

.md-reader-chapter-nav-button-active {
  border-color: #2549b0;
  background: #e7edff;
}
</style>
