import { createMemoryHistory, createRouter } from 'vue-router'

import Home from './pages/Home.vue'
import Login from './pages/Login.vue'
import Profile from './pages/Profile.vue'
import Transactions from './pages/Transactions.vue'
import Categories from './pages/Categories.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/profile', component: Profile },
  { path: '/transactions', component: Transactions },
  { path: '/categories', component: Categories },
]

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
})