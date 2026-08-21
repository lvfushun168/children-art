import { createApp } from 'vue'
import App from './App.vue'
import AdaptiveMultiSelect from './components/common/AdaptiveMultiSelect.vue'
import AdaptiveSelect from './components/common/AdaptiveSelect.vue'
import router from './router/index.js'
import './style.css'

createApp(App)
  .component('AdaptiveMultiSelect', AdaptiveMultiSelect)
  .component('AdaptiveSelect', AdaptiveSelect)
  .use(router)
  .mount('#app')
