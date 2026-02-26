<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import * as echarts from 'echarts';

const chartRef = ref<HTMLDivElement | null>(null);
const categories = ref<any[]>([]);
const transactions = ref<any[]>([]);
const selectedCategoryId = ref<number | null>(null);
let myChart: echarts.ECharts | null = null;

function getCategories() {
    const raw = localStorage.getItem('budget-manager:categories');
    if (!raw) {
        categories.value = [];
        return;
    }
    try {
        categories.value = JSON.parse(raw);
        if (categories.value.length && selectedCategoryId.value === null) {
            selectedCategoryId.value = categories.value[0].id;
        }
    } catch (e) {
        categories.value = [];
    }
}

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

function getCategoryBudgetLeft() {
    if (!selectedCategoryId.value) return null;
    const cat = categories.value.find((c: any) => c.id === selectedCategoryId.value);
    if (!cat) return null;
    const spent = transactions.value
        .filter((t: any) => Array.isArray(t.categories) && t.categories.includes(selectedCategoryId.value) && Number(t.amount) < 0)
        .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
    return {
        budget: cat.budget,
        left: cat.budget - spent,
        spent
    };
}

function updateChart() {
    if (!chartRef.value || !selectedCategoryId.value) return;
    const budgetInfo = getCategoryBudgetLeft();
    if (!budgetInfo) return;
    if (!myChart) {
        const theme = localStorage.getItem('budget-manager:theme') || 'light';
        myChart = echarts.init(chartRef.value, theme === 'white' ? null : 'dark');
    }
    const option = {
        title: {
            text: 'Budget restant',
            left: 'center'
        },
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} € ({d}%)'
        },
        legend: {
            orient: 'vertical',
            left: 'left'
        },
        series: [
            {
                name: 'Budget',
                type: 'pie',
                radius: '50%',
                data: [
                    { value: budgetInfo.left, name: 'Disponible' },
                    { value: budgetInfo.spent, name: 'Dépensé' }
                ],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ]
    };
    myChart.setOption(option);
}

const selectedDate = ref('2026-02');

onMounted(() => {
    getCategories();
    getTransactions(selectedDate.value);
});

watch([selectedCategoryId, transactions], () => {
    updateChart();
});

watch(() => selectedDate.value, (newDate) => {
    getTransactions(newDate);
    updateChart();
});
</script>

<template>
    <div class="chart">
        <div class="flex flex-row gap-8">
            <div>
                <label for="category-select" class="mr-2">Catégorie :</label>
            <select id="category-select" v-model="selectedCategoryId">
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
        </div>

        <div>
            <label for="date-selector">Période : </label>
            <select name="date" id="date-selector" v-model="selectedDate"
                @change="getTransactions(selectedDate)">
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
        </div>
    </div>

    <div class="flex flex-row relative">
        <div ref="chartRef" class="w-full h-full"></div>
        <div v-if="selectedCategoryId && getCategoryBudgetLeft()"
            class="mt-4 text-center flex flex-col justify-center absolute top-5 right-5">
            <p>Budget initial : <b>{{ getCategoryBudgetLeft()?.budget }} €</b></p>
            <p>Dépensé : <b>{{ getCategoryBudgetLeft()?.spent }} €</b></p>
            <p>Disponible : <b>{{ getCategoryBudgetLeft()?.left }} €</b></p>
        </div>
    </div>
    </div>
</template>

<style scoped></style>
