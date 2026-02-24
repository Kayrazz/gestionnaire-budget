<script setup lang="ts">
import Header from './components/Header.vue';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import getCookie from './utils/getCookies';

const menuOpen = ref(false);
function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

const route = useRoute();
const router = useRouter();


function logout() {
  document.cookie = 'user_id=; Max-Age=0; path=/;';
  router.push('/login');
}

// Redirige vers /login si pas de user_id, sauf si déjà sur /login
import { onMounted, watch } from 'vue';
function checkAuth() {
  const userId = getCookie('user_id');
  if (!userId && route.path !== '/login') {
    router.push('/login');
  } else if (userId && route.path === '/login') {
    router.push('/');
  }
}
onMounted(checkAuth);
watch(() => route.path, checkAuth);
</script>


<template>
  <!-- Afficher nav et header sauf sur /login -->
  <template v-if="route.path !== '/login'">
    <!-- Burger button for mobile -->
    <button class="md:hidden fixed top-4 left-4 z-50 p-2 rounded bg-gray-400 focus:outline-none" @click="toggleMenu"
      aria-label="Ouvrir le menu">
      <span class="block w-6 h-0.5 bg-black mb-1"></span>
      <span class="block w-6 h-0.5 bg-black mb-1"></span>
      <span class="block w-6 h-0.5 bg-black"></span>
    </button>

    <!-- Navigation -->
    <nav :class="[
      'bg-[var(--color-bg)] z-40 text-sm',
      'md:flex md:flex-col md:w-[150px] md:h-screen md:left-0 md:top-0 md:border-r-2 md:border-black',
      'fixed top-0 left-0 w-full flex flex-col items-start p-2 gap-2',
      menuOpen ? 'block' : 'hidden',
      'md:block'
    ]">
      <RouterLink to="/" class="link mb-2 md:mb-0 w-full" @click="menuOpen = false">Accueil</RouterLink>
      <RouterLink to="/transactions" class="link mb-2 md:mb-0 w-full" @click="menuOpen = false">Transactions
      </RouterLink>
      <RouterLink to="/categories" class="link mb-2 md:mb-0 w-full" @click="menuOpen = false">Catégories</RouterLink>
      <RouterLink to="/profile" class="link w-full" @click="menuOpen = false">Profil</RouterLink>
      <button type="button" class="link w-full text-left cursor-pointer" @click="logout">Se déconnecter</button>
    </nav>

    <Header />
  </template>
  <main :class="[route.path !== '/login' ? 'py-2 md:pl-[160px]' : '', route.path === '/login' ? 'py-0 pl-0' : 'pl-0']">
    <RouterView />
  </main>
</template>

<style scoped>
@import "tailwindcss";

.link {
  @apply px-4 p-2 rounded transition-colors block hover:text-white hover:bg-[var(--primary-color)];
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
