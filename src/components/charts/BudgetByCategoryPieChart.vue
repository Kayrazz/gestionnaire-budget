<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import * as echarts from 'echarts';

type EChartsOption = echarts.EChartsOption;

const chartRef = ref<HTMLDivElement | null>(null);
const categories = ref<any[]>([]);
let myChart: echarts.ECharts | null = null;

function getCategories() {
    const raw = localStorage.getItem('budget-manager:categories');
    if (!raw) {
        categories.value = [];
        return;
    }
    try {
        categories.value = JSON.parse(raw);
    } catch (e) {
        categories.value = [];
    }
}

function updateChart() {
    if (!chartRef.value || !categories.value.length) return;
    if (!myChart) {
        myChart = echarts.init(chartRef.value);
    }
    const option: EChartsOption = {
        title: {
            text: 'Budget par catégorie',
            left: 'center'
        },
        tooltip: {
            trigger: 'item'
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
                data: categories.value.map((cat: any) => ({
                    value: cat.budget,
                    name: cat.name
                })),
                label: {
                    show: true,
                    formatter: '{b}: {c} € ({d}%)',
                    width: 120,
                    overflow: 'break',
                },
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

onMounted(() => {
    getCategories();
    updateChart();
});

watch(categories, () => {
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
