<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BudgetPieChart from '../components/BudgetByCategoryPieChart.vue';
import CategoryBudgetPie from '../components/CategoryBudgetPie.vue';
import MonthlyExpensesBar from '../components/MonthlyExpensesBar.vue';

const selectedDate = ref('2026-02');
const transactions = ref<any[]>([]);

function getTransactions(date: string) {
    const raw = localStorage.getItem('budget-manager:transactions');
    if (!raw) {
        transactions.value = [];
        return;
    }
    try {
        const arr = JSON.parse(raw);
        const [year, month] = date.split('-');
        transactions.value = arr.filter((t: any) => {
            const tDate = new Date(t.date);
            return (
                tDate.getFullYear() === Number(year) &&
                tDate.getMonth() + 1 === Number(month)
            );
        });
    } catch (e) {
        transactions.value = [];
    }
}

onMounted(() => {
    getTransactions(selectedDate.value);
});
</script>

<template>
    <label for="date-selector">Période : </label>
    <select name="date" id="date-selector" class="mt-4" v-model="selectedDate" @change="getTransactions(selectedDate)">
        <option value="2026-01">Janvier 2026</option>
        <option value="2026-02">Février 2026</option>
        <option value="2026-03">Mars 2026</option>
        <option value="2026-04">Avril 2026</option>
        <option value="2026-05">Mai 2026</option>
        <option value="2026-06">Juin 2026</option>
        <option value="2026-07">Juillet 2026</option>
        <option value="2026-08">Août 2026</option>
        <option value="2026-09">Septembre 2026</option>
        <option value="2026-10">Octobre 2026</option>
        <option value="2026-11">Novembre 2026</option>
        <option value="2026-12">Décembre 2026</option>
    </select>

    <div class="flex flex-wrap gap-4 justify-center">
        <BudgetPieChart />
        <CategoryBudgetPie :selectedDate="selectedDate" />
        <MonthlyExpensesBar />
    </div>
</template>

<style scoped></style>
