<script setup>
import { computed, ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({ state: { type: Object, required: true } })
const keyword = ref('')
const type = ref('全部')
const showUpload = ref(false)
const draft = ref({ title: '', type: '范画', theme: '', age: '5-7岁', image: '' })

const visibleItems = computed(() => props.state.artworkLibrary.filter((item) => {
  const keywordOk = !keyword.value || `${item.title}${item.theme}${item.uploader}`.includes(keyword.value)
  return keywordOk && (type.value === '全部' || item.type === type.value)
}))

const handleImage = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  draft.value.image = URL.createObjectURL(file)
  if (!draft.value.title) draft.value.title = file.name.replace(/\.[^.]+$/, '')
}

const save = () => {
  props.state.addArtworkLibraryItem(draft.value)
  draft.value = { title: '', type: '范画', theme: '', age: '5-7岁', image: '' }
  showUpload.value = false
}
</script>

<template>
  <PageHead eyebrow="老师共享素材" title="范画库">
    <button class="primary" @click="showUpload = !showUpload">{{ showUpload ? '取消上传' : '上传到范画库' }}</button>
  </PageHead>

  <section v-if="showUpload" class="library-upload panel">
    <div class="section-head"><div><span>共享给校区老师</span><strong>上传一张可复用的范画</strong></div></div>
    <div class="form-grid">
      <label>名称<input v-model="draft.title" placeholder="例如：向日葵完整范画" /></label>
      <label>类型<select v-model="draft.type"><option>范画</option><option>步骤图</option></select></label>
      <label>主题<input v-model="draft.theme" placeholder="例如：花卉植物" /></label>
      <label>适用年龄<input v-model="draft.age" /></label>
      <label class="wide file-button library-file">选择图片<input type="file" accept="image/*" @change="handleImage" /></label>
    </div>
    <div class="stage-actions"><button class="primary" :disabled="!draft.title || !draft.image" @click="save">保存到范画库</button></div>
  </section>

  <section class="library-toolbar panel">
    <input v-model="keyword" placeholder="搜索名称、主题或上传老师" />
    <div class="student-tabs"><button v-for="itemType in ['全部', '范画', '步骤图']" :key="itemType" :class="{ selected: type === itemType }" @click="type = itemType">{{ itemType }}</button></div>
  </section>

  <section class="artwork-library-grid">
    <article v-for="item in visibleItems" :key="item.id" class="panel artwork-library-card">
      <img :src="item.image" :alt="item.title" />
      <div><span>{{ item.type }} · {{ item.theme }}</span><strong>{{ item.title }}</strong><small>{{ item.age }} · {{ item.uploader }}</small><small>已被老师使用 {{ item.usage }} 次</small></div>
    </article>
  </section>
</template>
