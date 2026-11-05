<script setup lang="ts">
import { computed } from 'vue';
import type { IncomingReportView } from '@/core/models/incoming-report-view.model';
import { displayValue, groupSpans } from '@/core/utils/incoming-report-view';

const props = defineProps<{ report: IncomingReportView }>();
const spans = computed(() => groupSpans(props.report.columns, props.report.rows.content));
</script>

<template>
    <div class="report-scroll">
        <table class="report-table">
            <caption>{{ report.report.nameReportIn }} — {{ report.period.namePeriod }} — {{ report.enterprise.nameEnterprise }}</caption>
            <thead><tr><th scope="col" class="row-number">Строка</th>
                <th v-for="column in report.columns" :key="column.key" scope="col">{{ column.name }}</th>
            </tr></thead>
            <tbody>
                <tr v-for="(row, rowIndex) in report.rows.content" :key="row.indexRow">
                    <th scope="row" class="row-number">{{ row.indexRow }}</th>
                    <template v-for="(cell, columnIndex) in row.cells" :key="report.columns[columnIndex].key">
                        <td v-if="spans[rowIndex][columnIndex] > 0" :rowspan="spans[rowIndex][columnIndex]"
                            :class="{ dimension: report.columns[columnIndex].dimension, numeric: report.columns[columnIndex].dataType === 'NUMBER' }">
                            {{ displayValue(cell.value, report.columns[columnIndex].dataType) }}
                        </td>
                    </template>
                </tr>
                <tr v-if="!report.rows.content.length"><td :colspan="report.columns.length + 1" class="empty-data">
                    Для выбранного отчёта, периода и предприятия загруженных данных нет.
                </td></tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.report-scroll { overflow: auto; max-height: 70vh; }
.report-table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 13px; }
caption { text-align: left; font-weight: 600; padding: 0 0 16px; color: var(--app-brand); }
th, td { border-right: 1px solid var(--app-border); border-bottom: 1px solid var(--app-border); padding: 10px 12px; min-width: 120px; white-space: pre-wrap; overflow-wrap: anywhere; }
tr > :first-child { border-left: 1px solid var(--app-border); }
thead th { border-top: 1px solid var(--app-border); background: var(--app-panel); position: sticky; top: 0; z-index: 1; text-align: center; }
td { background: var(--p-content-background); }
.row-number { min-width: 65px; width: 65px; text-align: center; font-weight: 400; color: var(--p-text-muted-color); background: var(--app-panel); }
.dimension { vertical-align: middle; }
.numeric { text-align: right; font-variant-numeric: tabular-nums; }
.empty-data { padding: 28px 16px; text-align: center; color: var(--p-text-muted-color); }
</style>
