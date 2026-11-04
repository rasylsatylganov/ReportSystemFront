<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Select from 'primevue/select';
import type { DrTypePeriod } from '@/core/models/dr-type-period.model';
import type { DrTypeEnterprise } from '@/core/models/dr-type-enterprise.model';
import { drTypePeriodService } from '@/core/services/dr-type-period.service';
import { drTypeEnterpriseService } from '@/core/services/dr-type-enterprise.service';
import type { IncomingReport } from '@/core/models/report-template.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { allPages, reportTemplateService } from '@/core/services/report-template.service';

const router = useRouter();
const reports = ref<IncomingReport[]>([]);
const loading = ref(false);
const error = ref('');
const first = ref(0);
const rows = ref(DEFAULT_PAGE_SIZE);
const total = ref(0);
const deleteTarget = ref<IncomingReport | null>(null);
const deleting = ref(false);
const deleteError = ref('');
const periodTypes = ref<DrTypePeriod[]>([]);
const enterpriseTypes = ref<DrTypeEnterprise[]>([]);
const selectedPeriodType = ref<number | null>(null);
const selectedEnterpriseType = ref<number | null>(null);
const filtersLoading = ref(false);
const filtersError = ref('');
let version = 0;

async function load() {
    const current = ++version;
    const periodType = selectedPeriodType.value;
    const enterpriseType = selectedEnterpriseType.value;
    if (periodType === null || enterpriseType === null) {
        reports.value = [];
        total.value = 0;
        first.value = 0;
        loading.value = false;
        return;
    }
    loading.value = true;
    error.value = '';
    try {
        let page = Math.floor(first.value / rows.value);
        let result = await reportTemplateService.list(page, rows.value, periodType, enterpriseType);
        if (current !== version) return;
        if (page > 0 && page >= result.totalPages) {
            page = Math.max(0, result.totalPages - 1);
            result = await reportTemplateService.list(page, rows.value, periodType, enterpriseType);
            if (current !== version) return;
        }
        reports.value = result.content;
        first.value = result.page * result.size;
        total.value = result.totalElements;
    } catch (cause) {
        if (current !== version) return;
        error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить отчёты.';
        reports.value = [];
        total.value = 0;
    } finally {
        if (current === version) loading.value = false;
    }
}
async function refresh() {
    ++version;
    filtersLoading.value = true;
    filtersError.value = '';
    error.value = '';
    try {
        const [periods, enterprises] = await Promise.all([
            allPages(drTypePeriodService.findPage), allPages(drTypeEnterpriseService.findPage),
        ]);
        periodTypes.value = periods;
        enterpriseTypes.value = enterprises;
        if (!periods.some(type => type.id === selectedPeriodType.value)) {
            selectedPeriodType.value = periods[0]?.id ?? null;
            first.value = 0;
        }
        if (!enterprises.some(type => type.id === selectedEnterpriseType.value)) {
            selectedEnterpriseType.value = enterprises[0]?.id ?? null;
            first.value = 0;
        }
        await load();
    } catch (cause) {
        filtersError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить фильтры.';
        reports.value = [];
        total.value = 0;
        loading.value = false;
    } finally { filtersLoading.value = false; }
}
async function changeFilter() {
    first.value = 0;
    await load();
}
async function changePage(event: DataTablePageEvent) {
    if (deleting.value || filtersLoading.value) return;
    first.value = event.first;
    rows.value = event.rows;
    await load();
}
async function remove() {
    if (!deleteTarget.value || deleting.value) return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await reportTemplateService.remove(deleteTarget.value.id);
        deleteTarget.value = null;
        await load();
    } catch (cause) {
        deleteError.value = cause instanceof Error ? cause.message : 'Не удалось удалить отчёт.';
    } finally { deleting.value = false; }
}
function createReport() {
    if (deleting.value || filtersLoading.value || filtersError.value ||
        selectedPeriodType.value === null || selectedEnterpriseType.value === null) return;
    void router.push({
        path: '/incoming-reports/new',
        query: { typePeriodId: String(selectedPeriodType.value), typeEnterpriseId: String(selectedEnterpriseType.value) },
    });
}
onMounted(refresh);
onBeforeUnmount(() => { ++version; });
</script>

<template>
    <div class="reports-page">
        <div class="toolbar">
            <div><h1>Входящие отчёты</h1><p>Создавайте формы отчётов и настраивайте правила чтения Excel.</p></div>
            <div class="actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary" :loading="loading || filtersLoading" :disabled="deleting" @click="refresh" />
                <Button label="Создать отчёт" icon="pi pi-plus" :disabled="deleting || filtersLoading || !!filtersError || selectedPeriodType === null || selectedEnterpriseType === null" @click="createReport" />
            </div>
        </div>
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <Message v-if="filtersError" severity="error" :closable="false">{{ filtersError }} Нажмите «Обновить».</Message>
        <section class="filter-panel" aria-label="Фильтры входящих отчётов">
            <div class="filter-title"><i class="pi pi-filter" aria-hidden="true"></i><h2>Фильтр</h2></div>
            <div class="filter-fields">
                <div class="filter-field"><label for="reports-period-type">Типы периодов</label>
                    <Select input-id="reports-period-type" v-model="selectedPeriodType" :options="periodTypes"
                            option-label="nameTypePeriod" option-value="id" placeholder="Выберите тип периода" filter
                            :loading="filtersLoading" :disabled="deleting || filtersLoading || !!filtersError"
                            empty-filter-message="Типы периодов не найдены" @change="changeFilter" />
                </div>
                <div class="filter-field"><label for="reports-enterprise-type">Типы предприятий</label>
                    <Select input-id="reports-enterprise-type" v-model="selectedEnterpriseType" :options="enterpriseTypes"
                            option-label="nameTypeEnterprise" option-value="id" placeholder="Выберите тип предприятия" filter
                            :loading="filtersLoading" :disabled="deleting || filtersLoading || !!filtersError"
                            empty-filter-message="Типы предприятий не найдены" @change="changeFilter" />
                </div>
            </div>
        </section>
        <Message v-if="!filtersLoading && !filtersError && (!periodTypes.length || !enterpriseTypes.length)" severity="info" :closable="false">
            Для фильтрации добавьте типы периодов и типы предприятий в справочниках.
        </Message>
        <DataTable :value="reports" :loading="loading || filtersLoading" data-key="id" striped-rows show-gridlines lazy paginator
                   :first="first" :rows="rows" :total-records="total" :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   current-page-report-template="{first}–{last} из {totalRecords}"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport">
            <template #empty>{{ error || filtersError ? 'Не удалось загрузить отчёты. Нажмите «Обновить».' : !selectedPeriodType || !selectedEnterpriseType ? 'Выберите тип периода и тип предприятия.' : 'Для выбранных типов отчёты не найдены.' }}</template>
            <Column field="codeReportIn" header="Код" />
            <Column field="nameReportIn" header="Наименование" />
            <Column field="typePeriod.nameTypePeriod" header="Тип периода" />
            <Column field="typeEnterprise.nameTypeEnterprise" header="Тип предприятия" />

            <Column header="Действия"><template #body="{ data }"><div class="actions">
                <Button label="Открыть" icon="pi pi-pencil" text :disabled="deleting" @click="router.push(`/incoming-reports/${data.id}`)" />
                <Button icon="pi pi-trash" text severity="danger" :aria-label="`Удалить ${data.nameReportIn}`" :disabled="deleting"
                        @click="deleteTarget = data; deleteError = ''" />
            </div></template></Column>
        </DataTable>
        <Dialog :visible="!!deleteTarget" header="Удаление входящего отчёта" modal :style="{ width: '32rem' }"
                :breakpoints="{ '640px': '95vw' }" :closable="!deleting" :close-on-escape="!deleting"
                @update:visible="value => { if (!value && !deleting) deleteTarget = null; }">
            <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>
            <p>Удалить отчёт «{{ deleteTarget?.nameReportIn }}» вместе с его структурой?</p>
            <p>Отчёт с загруженными данными удалить нельзя.</p>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="deleting" @click="deleteTarget = null" />
                <Button label="Удалить" severity="danger" :loading="deleting" @click="remove" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.reports-page { display: flex; flex-direction: column; gap: 20px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.actions { display: flex; align-items: center; gap: 8px; }
.filter-panel { padding: 18px 20px; background: var(--p-content-background); border: 1px solid var(--app-border); border-radius: 6px; }
.filter-title { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--app-brand); }
.filter-title h2 { margin: 0; font-size: 16px; }
.filter-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 320px)); gap: 16px; }
.filter-field { display: flex; flex-direction: column; gap: 7px; }
.filter-field label { font-weight: 600; font-size: 13px; }
@media (max-width: 640px) { .filter-fields { grid-template-columns: minmax(0, 1fr); } }
h1 { margin: 0; font-size: 23px; color: var(--app-brand); }
p { color: var(--p-text-muted-color); }
.reports-page :deep(.p-datatable-table-container) { overflow-x: auto; }
</style>
