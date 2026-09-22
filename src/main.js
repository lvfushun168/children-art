import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { toVueI18nSyntax, translationsEn } from 'pptx-vue-viewer/i18n'
import { translationsZhCN } from 'pptx-vue-viewer/i18n/zh-CN'
import App from './App.vue'
import AdaptiveMultiSelect from './components/common/AdaptiveMultiSelect.vue'
import AdaptiveSelect from './components/common/AdaptiveSelect.vue'
import router from './router/index.js'
import '@vuepic/vue-datepicker/dist/main.css'
import './style.css'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    en: translationsEn,
    'zh-CN': toVueI18nSyntax(translationsZhCN)
  }
})

createApp(App)
  .component('AdaptiveMultiSelect', AdaptiveMultiSelect)
  .component('AdaptiveSelect', AdaptiveSelect)
  .use(router)
  .use(i18n)
  .mount('#app')
