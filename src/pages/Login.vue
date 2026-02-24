<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const email = ref<string>('');
const password = ref<string>('');
const errorMsg = ref<string>('');
const router = useRouter();

async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMsg.value = '';
    try {
        const response = await fetch('/user.json');
        const data = await response.json();
        const user = data.users.find((u: any) => u.email === email.value && u.password === password.value);
        if (user) {
            // Stocker l'id utilisateur dans un cookie pour la session
            document.cookie = `user_id=${user.id}; path=/;`;
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
    <div class="min-h-screen flex items-center justify-center bg-gray-100">
        <form class="bg-white p-8 rounded shadow-md w-full max-w-sm space-y-6" @submit="handleSubmit">
            <h2 class="text-2xl font-bold text-center mb-4">Connexion</h2>
            <div v-if="errorMsg" class="text-red-500 text-center">{{ errorMsg }}</div>
            <div>
                <label for="email" class="block text-gray-700 mb-1">Email</label>
                <input id="email" v-model="email" type="email"
                    class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Votre email" required />
            </div>
            <div>
                <label for="password" class="block text-gray-700 mb-1">Mot de passe</label>
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