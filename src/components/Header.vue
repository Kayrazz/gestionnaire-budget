<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import getCookie from '../utils/getCookies';
import { usersManager } from '../utils/JsonManager';

const username = ref<string>('');
const ammount = ref<number>(0);
const showAmount = ref<boolean>(true);

const loadConnectedUser = async (): Promise<void> => {
    await usersManager.init();

    const userIdCookie = getCookie('user_id');
    const parsedUserId = userIdCookie ? Number.parseInt(userIdCookie, 10) : Number.NaN;

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        username.value = 'Utilisateur non connecté';
        ammount.value = 0;
        return;
    }

    const user = usersManager.getById(parsedUserId);

    if (!user) {
        username.value = 'Utilisateur introuvable';
        ammount.value = 0;
        return;
    }

    username.value = `${user.first_name} ${user.last_name}`.trim() || user.name;
    ammount.value = user.ammount;
};

onMounted(() => {
    const cookieValue = document.cookie.split('; ').find((row) => row.startsWith('showAmount='));
    if (cookieValue) {
        showAmount.value = cookieValue.split('=')[1] === 'true';
    }

    loadConnectedUser().catch((error: unknown) => {
        console.error('Error loading connected user:', error);
        username.value = 'Erreur utilisateur';
        ammount.value = 0;
    });
});

watch(showAmount, (newValue) => {
    document.cookie = `showAmount=${newValue}; path=/;`;
});
</script>

<template>
    <header
        class="header md:ml-[150px] flex md:justify-between justify-end gap-10 p-4 bg-gray-200 border-2 border-gray-400 rounded">
        <span id="username">{{ username }}</span>
        <span id="ammount">
            <button @click="showAmount = !showAmount" class="mr-2 text-gray-600 hover:text-gray-800 cursor-pointer">
                <i :class="showAmount ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
            </button>
            <span v-if="showAmount">{{ ammount }} €</span>
            <span v-else>••••••</span>
        </span>
    </header>
</template>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
</style>