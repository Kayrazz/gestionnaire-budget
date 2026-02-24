<script setup lang="ts">
import { ref } from 'vue';
const username = ref('');
const ammount = ref(0);
const showAmount = ref(true);
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
        class="header ml-[150px] flex items-center justify-between p-4 bg-gray-200 border-2 border-gray-400 rounded">
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