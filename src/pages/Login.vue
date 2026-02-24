<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { categoriesManager, transactionsManager, usersManager } from '../utils/JsonManager';

const email = ref<string>('');
const password = ref<string>('');
const errorMsg = ref<string>('');
const router = useRouter();

async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMsg.value = '';
    try {
        // Sauvegarder le thème avant de nettoyer le localStorage
        const THEME_STORAGE_KEY = "budget-manager:theme";
        const currentTheme = localStorage.getItem(THEME_STORAGE_KEY);
        
        // Supprimer toutes les données du localStorage avant la connexion
        localStorage.clear();
        
        // Restaurer le thème
        if (currentTheme) {
            localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
        }
        
        // Initialiser sans userId pour charger tous les utilisateurs
        await usersManager.init();

        const user = usersManager
            .getAll()
            .find((u) => u.email === email.value && u.password === password.value);

        if (user) {
            // Stocker l'id utilisateur dans un cookie pour la session
            document.cookie = `user_id=${user.id}; path=/;`;
            
            // Réinitialiser et charger les données filtrées par utilisateur
            await usersManager.init(user.id, true);
            await categoriesManager.init(user.id, true);
            await transactionsManager.init(user.id, true);
            
            router.push('/');
        } else {
            errorMsg.value = 'Email ou mot de passe incorrect.';
        }
    } catch (error) {
        errorMsg.value = "Erreur lors de la connexion.";
        console.error("Error fetching user data:", error);
    }
}
</script>
<template>
    <div class="login min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <form class="p-8 rounded shadow-md w-full max-w-sm space-y-6 bg-[var(--color-bg)]" @submit="handleSubmit">
            <h2 class="text-2xl font-bold text-center mb-4 text-[var(--color-text)]">Connexion</h2>
            <div v-if="errorMsg" class="text-red-500 text-center">{{ errorMsg }}</div>
            <div>
                <label for="email" class="block mb-1 text-[var(--color-text)]">Email</label>
                <input id="email" v-model="email" type="email"
                    class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Votre email" required />
            </div>
            <div>
                <label for="password" class="block mb-1 text-[var(--color-text)]">Mot de passe</label>
                <input id="password" v-model="password" type="password"
                    class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Votre mot de passe" required />
            </div>
            <button type="submit"
                class="w-full bg-[var(--primary-color)] hover:bg-[var(--hover-primary-color)] cursor-pointer text-white font-semibold py-2 rounded transition-colors">
                Se connecter
            </button>
        </form>
    </div>
</template>
<style scoped></style>