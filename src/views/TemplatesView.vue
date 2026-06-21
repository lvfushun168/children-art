<script setup>
import PageHead from '../components/layout/PageHead.vue'

defineProps({
  templates: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <PageHead eyebrow="机构标准化" title="模板管理">
    <button class="primary">新增模板</button>
  </PageHead>

  <section class="split-grid">
    <article class="panel">
      <div class="section-head">
        <div>
          <span>图片模板</span>
          <strong>{{ templates.image.length }} 套</strong>
        </div>
      </div>
      <div v-for="item in templates.image" :key="item.name" class="template-row">
        <strong>{{ item.name }}</strong>
        <span>{{ item.ratio }} · {{ item.brightness }}</span>
        <small>{{ item.border }} · {{ item.watermark }}</small>
      </div>
    </article>

    <article class="panel">
      <div class="section-head">
        <div>
          <span>课评模板</span>
          <strong>{{ templates.comment.length }} 套</strong>
        </div>
      </div>
      <div v-for="item in templates.comment" :key="item.name" class="template-row">
        <strong>{{ item.name }}</strong>
        <span>{{ item.tone }} · {{ item.length }}</span>
        <small>{{ item.rule }}</small>
      </div>
    </article>

    <article class="panel">
      <div class="section-head">
        <div>
          <span>提示词模板</span>
          <strong>{{ templates.prompt.length }} 套</strong>
        </div>
      </div>
      <div v-for="item in templates.prompt" :key="item.name" class="template-row">
        <strong>{{ item.name }}</strong>
        <span>{{ item.model }}</span>
        <small>{{ item.status }}</small>
      </div>
    </article>

    <article class="panel">
      <div class="section-head">
        <div>
          <span>水印配置</span>
          <strong>{{ templates.watermark.length }} 项</strong>
        </div>
      </div>
      <div v-for="item in templates.watermark" :key="item.name" class="template-row">
        <strong>{{ item.name }}</strong>
        <span>{{ item.value }}</span>
        <small>{{ item.status }}</small>
      </div>
    </article>
  </section>
</template>
