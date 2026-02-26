import { createWebHistory, createRouter } from 'vue-router'

import Home from './pages/Home.vue'
import Login from './pages/Login.vue'
import Profile from './pages/Profile.vue'
import Transactions from './pages/Transactions.vue'
import Categories from './pages/Categories.vue'
import Regles from './pages/Regles.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/profile', component: Profile },
  { path: '/transactions', component: Transactions },
  { path: '/categories', component: Categories },
  { path: '/regles', component: Regles },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})