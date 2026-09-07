<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { prepareChapterMarkdownForRender } from '@shared/chapter-markdown-render'
import { applyReplacementRules } from '@shared/replacement-rules'
import type { ChapterItem, ReaderPreference } from '@shared/reader-types'
import type { ReplacementRule } from '@shared/replacement-rules'

const props = withDefaults(
  defineProps<{
    chapter: ChapterItem | null
    preference: ReaderPreference
    replacementRules?: ReplacementRule[]
    initialScrollTop?: number
    hideTitle?: boolean
  }>(),
  {
    initialScrollTop: 0,
    hideTitle: false,
    replacementRules: () => []
  }
)

const emit = defineEmits<{
  scrollChange: [state: ReaderScrollState]
}>()

interface ReaderScrollState {
  scrollTop: number
  canScrollPrevious: boolean
  canScrollNext: boolean
}

const mdParser = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})
mdParser.disable('lheading')
mdParser.renderer.rules.s_open = () => ''
mdParser.renderer.rules.s_close = () => ''

const mdReaderArticleBodyRef = ref<HTMLElement | null>(null)
const readerPageOverlapLines = 2
const readerPageScrollDurationMs = 160
let readerPageScrollFrame: number | null = null

const mdReaderArticleHtml = computed(() => {
  if (!props.chapter) {
    return '<p>请选择一个章节开始阅读。</p>'
  }

  const markdown = prepareChapterMarkdownForRender(props.chapter.markdown, props.replacementRules)
  return mdParser.render(markdown)
})

const mdReaderChapterTitle = computed(() => {
  const title = props.chapter?.title?.trim()
  if (!title) {
    return '未选择章节'
  }

  return applyReplacementRules(title, props.replacementRules)
})

const mdReaderArticleStyle = computed(() => ({
  '--md-reader-font-size': `${props.preference.fontSize}px`,
  '--md-reader-line-height': String(props.preference.lineHeight),
  '--md-reader-content-padding': `${props.preference.contentPadding}px`,
  '--md-reader-font-color': props.preference.fontColor,
  '--md-reader-background-color': props.preference.backgroundColor
}))

function handleReaderScroll(event: Event): void {
  const target = event.target as HTMLElement | null
  emitReaderScrollState(target)
}

function emitReaderScrollState(target: HTMLElement | null = mdReaderArticleBodyRef.value): void {
  if (!target) {
    return
  }

  const maxScrollTop = Math.max(target.scrollHeight - target.clientHeight, 0)
  emit('scrollChange', {
    scrollTop: Math.max(target.scrollTop, 0),
    canScrollPrevious: target.scrollTop > 0,
    canScrollNext: target.scrollTop < maxScrollTop
  })
}

function cancelPageScroll(): void {
  if (readerPageScrollFrame === null) {
    return
  }

  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(readerPageScrollFrame)
  }
  readerPageScrollFrame = null
}

function setScrollTop(target: HTMLElement, top: number): void {
  if (typeof target.scrollTo === 'function') {
    target.scrollTo({ top, behavior: 'auto' })
  } else {
    target.scrollTop = top
  }
}

function animatePageScroll(target: HTMLElement, nextScrollTop: number): void {
  cancelPageScroll()

  const startScrollTop = target.scrollTop
  const scrollDistance = nextScrollTop - startScrollTop
  if (scrollDistance === 0) {
    setScrollTop(target, nextScrollTop)
    return
  }

  if (typeof requestAnimationFrame !== 'function') {
    setScrollTop(target, nextScrollTop)
    return
  }

  let animationStartTime: number | null = null
  const animate = (timestamp: number): void => {
    animationStartTime ??= timestamp
    const progress = Math.min((timestamp - animationStartTime) / readerPageScrollDurationMs, 1)
    const easedProgress = 1 - Math.pow(1 - progress, 3)
    setScrollTop(target, startScrollTop + scrollDistance * easedProgress)

    if (progress < 1) {
      readerPageScrollFrame = requestAnimationFrame(animate)
    } else {
      readerPageScrollFrame = null
    }
  }

  readerPageScrollFrame = requestAnimationFrame(animate)
}

function scrollByPage(direction: -1 | 1): void {
  const target = mdReaderArticleBodyRef.value
  if (!target || target.clientHeight <= 0) {
    return
  }

  const maxScrollTop = Math.max(target.scrollHeight - target.clientHeight, 0)
  const lineHeight = props.preference.fontSize * props.preference.lineHeight
  const overlap = Math.round(lineHeight * readerPageOverlapLines)
  const pageStep = Math.max(target.clientHeight - overlap, 1)
  const nextScrollTop = Math.min(
    Math.max(target.scrollTop + direction * pageStep, 0),
    maxScrollTop
  )

  animatePageScroll(target, nextScrollTop)
}

async function syncReaderScroll(): Promise<void> {
  await nextTick()
  const top = Math.max(props.initialScrollTop, 0)
  if (!mdReaderArticleBodyRef.value) return
  cancelPageScroll()
  mdReaderArticleBodyRef.value.scrollTop = top
  emitReaderScrollState()
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

onBeforeUnmount(() => {
  cancelPageScroll()
})

defineExpose({ scrollByPage })
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
.md-reader-article-body-article :deep(h4),
.md-reader-article-body-article :deep(h5),
.md-reader-article-body-article :deep(h6) {
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  font-size: inherit;
  font-weight: 600;
  line-height: inherit;
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
