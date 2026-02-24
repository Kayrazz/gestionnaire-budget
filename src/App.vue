<script setup lang="ts">
import Header from './components/Header.vue';

import { ref } from 'vue';

const menuOpen = ref(false);

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}
</script>


<template>
  <!-- Burger button for mobile -->
  <button class="md:hidden fixed top-4 left-4 z-50 p-2 rounded bg-gray-400 focus:outline-none" @click="toggleMenu"
    aria-label="Ouvrir le menu">
    <span class="block w-6 h-0.5 bg-black mb-1"></span>
    <span class="block w-6 h-0.5 bg-black mb-1"></span>
    <span class="block w-6 h-0.5 bg-black"></span>
  </button>

  <!-- Navigation -->
  <nav :class="[
    'bg-gray-300 z-40',
    'md:flex md:flex-col md:w-[150px] md:absolute md:h-screen md:left-0 md:top-0',
    'fixed top-0 left-0 w-full flex flex-col items-start p-4 gap-2',
    menuOpen ? 'block' : 'hidden',
    'md:block'
  ]">
    <RouterLink to="/" class="link mb-2 md:mb-0">Accueil</RouterLink>
    <RouterLink to="/transactions" class="link mb-2 md:mb-0">Transactions</RouterLink>
    <RouterLink to="/categories" class="link mb-2 md:mb-0">Catégories</RouterLink>
    <RouterLink to="/profile" class="link">Profil</RouterLink>
  </nav>

  <Header />
  <main :class="['py-2', 'md:pl-[160px]', 'pl-0']">
    <RouterView />
  </main>
</template>

<style scoped>
@import "tailwindcss";

.link {
  @apply px-4 py-2 rounded hover:bg-gray-400 transition-colors block;
}

@media (max-width: 767px) {
  nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: auto;
    background: #d1d5db;
    flex-direction: column;
    align-items: flex-start;
    padding-top: 60px;
    gap: 0.5rem;
  }
}
</style>
