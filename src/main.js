import { createApp } from 'vue'
import App from './App.vue'
import AdaptiveSelect from './components/common/AdaptiveSelect.vue'
import './style.css'

createApp(App)
  .component('AdaptiveSelect', AdaptiveSelect)
  .mount('#app')
