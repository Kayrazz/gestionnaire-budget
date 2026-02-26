import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'

const THEME_STORAGE_KEY = 'budget-manager:theme'
const ALLOWED_THEMES = ['white', 'black', 'purple'] as const
type AppTheme = (typeof ALLOWED_THEMES)[number]

const isAppTheme = (value: string | null): value is AppTheme => {
    return value !== null && (ALLOWED_THEMES as readonly string[]).includes(value)
}

const applyInitialTheme = (): void => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    const theme: AppTheme = isAppTheme(savedTheme) ? savedTheme : 'white'
    document.documentElement.setAttribute('data-theme', theme)
}

applyInitialTheme()

const pinia = createPinia()

createApp(App).use(pinia).use(router).mount('#app')