<script setup lang="ts">
fetch('/transaction.json')
    .then(response => response.json())
    .then(data => {
        // Utilise les données ici
        console.log(data);
    });
</script>

<template>
    <div class="main">
        <span class="">Main Content</span>
    </div>
</template>

<style scoped></style>
