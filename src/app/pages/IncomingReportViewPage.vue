<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Paginator from 'primevue/paginator';
import Select from 'primevue/select';
import IncomingReportTable from '@/app/components/IncomingReportTable.vue';
import type { DrTypePeriod } from '@/core/models/dr-type-period.model';
import type { DrTypeEnterprise } from '@/core/models/dr-type-enterprise.model';
import type { DrPeriod } from '@/core/models/dr-period.model';
import type { DrEnterprise } from '@/core/models/dr-enterprise.model';
import type { IncomingReport } from '@/core/models/report-template.model';
import type { IncomingReportView } from '@/core/models/incoming-report-view.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drTypePeriodService } from '@/core/services/dr-type-period.service';
import { drTypeEnterpriseService } from '@/core/services/dr-type-enterprise.service';
import { drPeriodService } from '@/core/services/dr-period.service';
import { drEnterpriseService } from '@/core/services/dr-enterprise.service';
import { allPages, reportTemplateService } from '@/core/services/report-template.service';
import { incomingReportViewService } from '@/core/services/incoming-report-view.service';

const periodTypes = ref<DrTypePeriod[]>([]);
const enterpriseTypes = ref<DrTypeEnterprise[]>([]);
const reports = ref<IncomingReport[]>([]);
const periods = ref<DrPeriod[]>([]);
const enterprises = ref<DrEnterprise[]>([]);
const typePeriodId = ref<number | null>(null);
const typeEnterpriseId = ref<number | null>(null);
const reportId = ref<number | null>(null);
const periodId = ref<number | null>(null);
const enterpriseId = ref<number | null>(null);
const catalogsLoading = ref(false);
const optionsLoading = ref(false);
const loading = ref(false);
const catalogsError = ref('');
const optionsError = ref('');
const error = ref('');
const view = ref<IncomingReportView | null>(null);
const first = ref(0);
const rows = ref(DEFAULT_PAGE_SIZE);
let catalogVersion = 0;
let optionVersion = 0;
let viewVersion = 0;
const reportOptions = computed(() => reports.value.map(report => ({
    id: report.id, label: `${report.nameReportIn} (${report.codeReportIn})`,
})));
const canView = computed(() => !catalogsLoading.value && !optionsLoading.value && !catalogsError.value &&
    !optionsError.value && reportId.value !== null && periodId.value !== null && enterpriseId.value !== null);

function message(cause: unknown) { return cause instanceof Error ? cause.message : 'Не удалось выполнить запрос.'; }
function clearView() {
    ++viewVersion;
    view.value = null;
    first.value = 0;
    loading.value = false;
    error.value = '';
}
async function loadOptions() {
    const version = ++optionVersion;
    clearView();
    reportId.value = null;
    periodId.value = null;
    enterpriseId.value = null;
    reports.value = [];
    periods.value = [];
    enterprises.value = [];
    optionsError.value = '';
    optionsLoading.value = false;
    const periodType = typePeriodId.value;
    const enterpriseType = typeEnterpriseId.value;
    if (periodType === null || enterpriseType === null) return;
    optionsLoading.value = true;
    try {
        const [reportList, periodList, enterpriseList] = await Promise.all([
            allPages((page, size) => reportTemplateService.list(page, size, periodType, enterpriseType)),
            allPages((page, size) => drPeriodService.findPage(page, size, periodType)),
            allPages((page, size) => drEnterpriseService.findPage(page, size, enterpriseType)),
        ]);
        if (version !== optionVersion) return;
        reports.value = reportList;
        periods.value = periodList;
        enterprises.value = enterpriseList;
    } catch (cause) {
        if (version === optionVersion) optionsError.value = message(cause);
    } finally { if (version === optionVersion) optionsLoading.value = false; }
}
async function refresh() {
    const version = ++catalogVersion;
    ++optionVersion;
    clearView();
    catalogsLoading.value = true;
    catalogsError.value = '';
    try {
        const [periodList, enterpriseList] = await Promise.all([
            allPages(drTypePeriodService.findPage), allPages(drTypeEnterpriseService.findPage),
        ]);
        if (version !== catalogVersion) return;
        periodTypes.value = periodList;
        enterpriseTypes.value = enterpriseList;
        if (!periodList.some(type => type.id === typePeriodId.value)) typePeriodId.value = periodList[0]?.id ?? null;
        if (!enterpriseList.some(type => type.id === typeEnterpriseId.value)) typeEnterpriseId.value = enterpriseList[0]?.id ?? null;
        await loadOptions();
    } catch (cause) {
        if (version === catalogVersion) catalogsError.value = message(cause);
    } finally { if (version === catalogVersion) catalogsLoading.value = false; }
}
async function load(page = 0) {
    if (!canView.value) return;
    const version = ++viewVersion;
    loading.value = true;
    error.value = '';
    view.value = null;
    try {
        const selectedReport = reportId.value!;
        const selectedPeriod = periodId.value!;
        const selectedEnterprise = enterpriseId.value!;
        let result = await incomingReportViewService.get(selectedReport, selectedPeriod, selectedEnterprise, page, rows.value);
        if (version !== viewVersion) return;
        if (page > 0 && page >= result.rows.totalPages) {
            result = await incomingReportViewService.get(selectedReport, selectedPeriod, selectedEnterprise,
                Math.max(0, result.rows.totalPages - 1), rows.value);
            if (version !== viewVersion) return;
        }
        view.value = result;
        first.value = result.rows.page * result.rows.size;
    } catch (cause) {
        if (version === viewVersion) error.value = message(cause);
    } finally { if (version === viewVersion) loading.value = false; }
}
function changePage(event: { first: number; rows: number }) {
    rows.value = event.rows;
    void load(Math.floor(event.first / event.rows));
}
onMounted(refresh);
onBeforeUnmount(() => { ++catalogVersion; ++optionVersion; ++viewVersion; });
</script>

<template>
    <div class="report-view-page">
        <div class="toolbar"><div><h1>Входящие отчёты</h1><p>Просмотр загруженных данных отчёта.</p></div>
            <Button label="Обновить списки" icon="pi pi-refresh" severity="secondary" :loading="catalogsLoading" @click="refresh" />
        </div>
        <Message v-if="catalogsError" severity="error" :closable="false">{{ catalogsError }}</Message>
        <section class="filter-panel" aria-label="Фильтры просмотра входящего отчёта">
            <h2><i class="pi pi-filter" aria-hidden="true"></i> Фильтр</h2>
            <div class="filter-grid">
                <div class="control"><label for="view-type-period">Тип периода</label>
                    <Select input-id="view-type-period" v-model="typePeriodId" :options="periodTypes" option-label="nameTypePeriod"
                            option-value="id" placeholder="Выберите тип периода" filter :disabled="catalogsLoading" @change="loadOptions" /></div>
                <div class="control"><label for="view-type-enterprise">Тип предприятия</label>
                    <Select input-id="view-type-enterprise" v-model="typeEnterpriseId" :options="enterpriseTypes" option-label="nameTypeEnterprise"
                            option-value="id" placeholder="Выберите тип предприятия" filter :disabled="catalogsLoading" @change="loadOptions" /></div>
                <div class="control"><label for="view-report">Отчёт</label>
                    <Select input-id="view-report" v-model="reportId" :options="reportOptions" option-label="label"
                            option-value="id" placeholder="Выберите отчёт" filter :loading="optionsLoading"
                            :disabled="catalogsLoading || optionsLoading || !!optionsError" @change="clearView" /></div>
                <div class="control"><label for="view-period">Период</label>
                    <Select input-id="view-period" v-model="periodId" :options="periods" option-label="namePeriod"
                            option-value="id" placeholder="Выберите период" filter :loading="optionsLoading"
                            :disabled="catalogsLoading || optionsLoading || !!optionsError || reportId === null" @change="clearView" /></div>
                <div class="control"><label for="view-enterprise">Предприятие</label>
                    <Select input-id="view-enterprise" v-model="enterpriseId" :options="enterprises" option-label="nameEnterprise"
                            option-value="id" placeholder="Выберите предприятие" filter :loading="optionsLoading"
                            :disabled="catalogsLoading || optionsLoading || !!optionsError || reportId === null" @change="clearView" /></div>
            </div>
            <Message v-if="optionsError" severity="error" :closable="false">{{ optionsError }}
                <Button label="Повторить" text @click="loadOptions" /></Message>
            <Message v-if="!catalogsLoading && !catalogsError && (!periodTypes.length || !enterpriseTypes.length)" severity="info" :closable="false">
                Сначала добавьте типы периодов и типы предприятий в справочниках.
            </Message>
            <Message v-else-if="!catalogsLoading && !optionsLoading && !optionsError && (!reports.length || !periods.length || !enterprises.length)"
                     severity="info" :closable="false">Для выбранных типов отсутствуют отчёты, периоды или предприятия. Проверьте справочники и метаданные.</Message>
            <Button label="Показать отчёт" icon="pi pi-table" :loading="loading" :disabled="!canView || loading" @click="load(0)" />
        </section>
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <Message v-if="loading" severity="info" :closable="false">Загрузка страницы отчёта…</Message>
        <section v-if="view" class="data-panel" aria-label="Данные входящего отчёта">
            <IncomingReportTable :report="view" />
            <Paginator v-if="view.rows.totalElements" :first="first" :rows="rows" :total-records="view.rows.totalElements"
                       :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                       template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                       current-page-report-template="{first}–{last} из {totalRecords}" />
        </section>
        <p v-if="!view && !loading && !error" class="hint">Выберите отчёт, период и предприятие, затем нажмите «Показать отчёт».</p>
    </div>
</template>

<style scoped>
.report-view-page { display: flex; flex-direction: column; gap: 20px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 23px; color: var(--app-brand); }
.toolbar p, .hint { color: var(--p-text-muted-color); }
h2 { margin: 0; font-size: 16px; color: var(--app-brand); }
.filter-panel, .data-panel { padding: 20px; background: var(--p-content-background); border: 1px solid var(--app-border); border-radius: 6px; min-width: 0; }
.filter-panel { display: flex; flex-direction: column; gap: 18px; align-items: start; }
.filter-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; width: 100%; }
.control { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.control label { font-size: 13px; font-weight: 600; }
@media (max-width: 800px) { .filter-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
