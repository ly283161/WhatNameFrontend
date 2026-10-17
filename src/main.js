import { createApp } from 'vue'
import './style.css'
import './application.css'

const { default: App } = import.meta.env.DEV && import.meta.env.VITE_APP_MODE === 'demo'
  ? await import('./demo/PrototypeApp.vue')
  : await import('./App.vue')
createApp(App).mount('#app')
