<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { ChapterItem, ReaderPreference } from '@shared/reader-types'

const props = withDefaults(
  defineProps<{
    chapter: ChapterItem | null
    preference: ReaderPreference
    initialScrollTop?: number
    hideTitle?: boolean
  }>(),
  {
    initialScrollTop: 0,
    hideTitle: false
  }
)

const emit = defineEmits<{
  scrollChange: [scrollTop: number]
}>()

const mdParser = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

const mdReaderArticleBodyRef = ref<HTMLElement | null>(null)

const mdReaderArticleHtml = computed(() => {
  if (!props.chapter) {
    return '<p>请选择一个章节开始阅读。</p>'
  }

  return mdParser.render(props.chapter.markdown)
})

const mdReaderChapterTitle = computed(() => {
  const title = props.chapter?.title?.trim()
  if (!title) {
    return '未选择章节'
  }

  return title
})

const mdReaderArticleStyle = computed(() => ({
  '--md-reader-font-size': `${props.preference.fontSize}px`,
  '--md-reader-line-height': String(props.preference.lineHeight),
  '--md-reader-content-padding': `${props.preference.contentPadding}px`,
  '--md-reader-font-color': props.preference.fontColor,
  '--md-reader-background-color': props.preference.backgroundColor
}))

function handleReaderScroll(event: Event): void {
  const target = event.target as HTMLElement
  const scrollTop = target?.scrollTop ?? 0
  emit('scrollChange', scrollTop)
}

async function syncReaderScroll(): Promise<void> {
  await nextTick()
  const top = Math.max(props.initialScrollTop, 0)
  if (!mdReaderArticleBodyRef.value) return
  mdReaderArticleBodyRef.value.scrollTop = top
}

watch(
  () => [props.chapter?.id, props.initialScrollTop],
  () => {
    void syncReaderScroll()
  },
  { immediate: true }
)

onMounted(() => {
  void syncReaderScroll()
})
</script>

<template>
  <section class="md-reader-article-shell-section" aria-label="章节内容">
    <header v-if="!props.hideTitle" class="md-reader-article-title-header" data-testid="md-reader-article-title">
      {{ mdReaderChapterTitle }}
    </header>
    <article
      ref="mdReaderArticleBodyRef"
      class="md-reader-article-body-article"
      data-testid="md-reader-article-content"
      :style="mdReaderArticleStyle"
      @scroll="handleReaderScroll"
      v-html="mdReaderArticleHtml"
    />
  </section>
</template>

<style lang="less" scoped>
.md-reader-article-shell-section {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
}

.md-reader-article-title-header {
  padding: 11px 14px;
  border: 1px solid #d7c8a9;
  border-radius: 12px;
  background: linear-gradient(180deg, #fff9e9 0%, #f5e6c1 100%);
  color: #3a2e1a;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  box-shadow: 0 6px 18px rgba(53, 41, 19, 0.12);
}

.md-reader-article-body-article {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: var(--md-reader-content-padding);
  font-size: var(--md-reader-font-size);
  line-height: var(--md-reader-line-height);
  color: var(--md-reader-font-color);
  background-color: var(--md-reader-background-color);
  border-radius: 12px;
  border: 1px solid #d7c8a9;
  box-shadow: 0 8px 22px rgba(53, 41, 19, 0.1);
}

.md-reader-article-body-article :deep(h1),
.md-reader-article-body-article :deep(h2),
.md-reader-article-body-article :deep(h3),
.md-reader-article-body-article :deep(h4) {
  margin-top: 1.25em;
  margin-bottom: 0.5em;
}

.md-reader-article-body-article :deep(p) {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

@media (max-width: 900px) {
  .md-reader-article-title-header {
    padding-top: 10px;
    padding-bottom: 10px;
    font-size: 13px;
  }
}
</style>
