<script setup lang="ts">
import BudgetPieChart from '../components/charts/BudgetByCategoryPieChart.vue';
import CategoryBudgetPie from '../components/charts/CategoryBudgetPie.vue';
import MonthlyExpensesBar from '../components/charts/MonthlyExpensesBar.vue';
</script>

<template>
    

    <div class="flex flex-wrap gap-4 justify-center mt-4">
        <BudgetPieChart />
        <CategoryBudgetPie />
        <MonthlyExpensesBar />
    </div>
</template>

<style scoped></style>
