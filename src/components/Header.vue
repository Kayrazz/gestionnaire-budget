<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const username = ref<string>('');
const ammount = ref<number>(0);
const showAmount = ref<boolean>(true);

onMounted(() => {
    const cookieValue = document.cookie.split('; ').find(row => row.startsWith('showAmount='));
    if (cookieValue) {
        showAmount.value = cookieValue.split('=')[1] === 'true';
    }
});

watch(showAmount, (newValue) => {
    document.cookie = `showAmount=${newValue}`;
})


fetch("/user.json")
    .then((response) => response.json())
    .then((data) => {
        const user = data.users[0];
        username.value = `${user.first_name} ${user.last_name}`;
        ammount.value = user.ammount;
    })
    .catch((error) => {
        console.error("Error fetching user data:", error);
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