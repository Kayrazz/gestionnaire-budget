<script setup lang="ts">
import Header from './components/Header.vue';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from './stores/userStore';
import { onMounted, watch } from 'vue';

const menuOpen = ref(false);
function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();


function logout() {
  userStore.logout();
  router.push('/login');
}

// Redirige vers /login si l'utilisateur n'est pas authentifié, sauf sur /login.
async function checkAuth() {
  await userStore.restoreSession();

  if (!userStore.isAuthenticated && route.path !== '/login') {
    router.push('/login');
  } else if (userStore.isAuthenticated && route.path === '/login') {
    router.push('/');
  }
}

onMounted(() => {
  void checkAuth();
});

watch(
  () => route.path,
  () => {
    void checkAuth();
  },
);
</script>


<template>
  <!-- Afficher nav et header sauf sur /login -->
  <template v-if="route.path !== '/login'">
    <!-- Sidebar (header) -->
    <!-- Burger button for mobile -->
    <button class="md:hidden fixed top-7 left-10 z-51 p-2 rounded bg-[var(--color-bg)] focus:outline-none"
      @click="toggleMenu" aria-label="Ouvrir le menu">
      <span class="block w-6 h-0.5 bg-[var(--color-text)] mb-1"></span>
      <span class="block w-6 h-0.5 bg-[var(--color-text)] mb-1"></span>
      <span class="block w-6 h-0.5 bg-[var(--color-text)]"></span>
    </button>
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
      <RouterLink to="/categories" class="link mb-2 md:mb-0 w-full" @click="menuOpen = false">Catégories
      </RouterLink>
      <RouterLink to="/regles" class="link mb-2 md:mb-0 w-full" @click="menuOpen = false">Règles</RouterLink>
      <RouterLink to="/profile" class="link w-full" @click="menuOpen = false">Profil</RouterLink>
      <button type="button" class="link w-full text-left cursor-pointer" @click="logout">Se déconnecter</button>
    </nav>
    <!-- Main content -->
    <main class="px-4 pb-4 pt-22 relative">
      <Header />
      <RouterView />
    </main>
  </template>

  <template v-else>
    <RouterView />
  </template>

</template>

<style scoped>
@import "tailwindcss";

.link {
  @apply px-4 p-2 rounded transition-colors block hover:text-[var(--color-text-nav)] hover:bg-[var(--primary-color)];
}

@media (max-width: 767px) {
  nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: auto;
    background: var(--color-bg);
    flex-direction: column;
    align-items: flex-start;
    padding-top: 80px;
    gap: 0.5rem;
  }
}
</style>
