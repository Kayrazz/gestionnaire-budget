<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as echarts from 'echarts';

const chartRef = ref<HTMLDivElement | null>(null);
let myChart: echarts.ECharts | null = null;

function getMonthlyExpenses() {
    const raw = localStorage.getItem('budget-manager:transactions');
    // Always return an object with months and sums
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }));
    }
    if (!raw) return { months, sums: Array(12).fill(0) };
    try {
        const arr = JSON.parse(raw);
        const sums = months.map((label, idx) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            return arr.filter((t: any) => {
                const tDate = new Date(t.date);
                return tDate.getFullYear() === year && tDate.getMonth() + 1 === month && Number(t.amount) < 0;
            }).reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
        });
        return { months, sums };
    } catch {
        return { months, sums: Array(12).fill(0) };
    }
}

function updateChart() {
    if (!chartRef.value) return;
    if (!myChart) {
        const theme = localStorage.getItem('budget-manager:theme') || 'light';
        myChart = echarts.init(chartRef.value, theme === 'white' ? null : 'dark');
    }
    const { months, sums } = getMonthlyExpenses();
    const option = {
        title: {
            text: 'Dépenses mensuelles sur 12 mois',
            left: 'center',
            top: 10
        },
        xAxis: {
            type: 'category',
            data: months,
            name: 'Mois',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: {
                interval: 0,
                rotate: 40,
                fontWeight: 'bold',
            }
        },
        yAxis: {
            type: 'value',
            name: 'Montant (€)',
            nameLocation: 'middle',
            nameGap: 40
        },
        series: [
            {
                data: sums,
                type: 'bar',
                itemStyle: {
                    color: '#3b82f6'
                },
                label: {
                    show: true,
                    position: 'top',
                    formatter: function (params: any) {
                        // Affiche max 2 chiffres après la virgule, sans trailing zeros inutiles
                        let val = Number(params.value);
                        let str = val % 1 === 0 ? val.toString() : val.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1');
                        return str + ' €';
                    },
                    fontWeight: 'bold',
                }
            }
        ]
    };
    myChart.setOption(option);
}

onMounted(() => {
    updateChart();
});
</script>

<template>
    <div class="chart">
        <div></div>
        <div ref="chartRef"></div>
    </div>
</template>

<style scoped></style>
