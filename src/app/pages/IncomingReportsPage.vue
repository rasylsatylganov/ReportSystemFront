<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import type { IncomingReport } from '@/core/models/report-template.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { reportTemplateService } from '@/core/services/report-template.service';

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
let version = 0;

async function load() {
    const current = ++version;
    loading.value = true;
    error.value = '';
    try {
        let page = Math.floor(first.value / rows.value);
        let result = await reportTemplateService.list(page, rows.value);
        if (current !== version) return;
        if (page > 0 && page >= result.totalPages) {
            page = Math.max(0, result.totalPages - 1);
            result = await reportTemplateService.list(page, rows.value);
            if (current !== version) return;
        }
        reports.value = result.content;
        first.value = result.page * result.size;
        total.value = result.totalElements;
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить отчёты.';
        reports.value = [];
        total.value = 0;
    } finally {
        if (current === version) loading.value = false;
    }
}
async function changePage(event: DataTablePageEvent) {
    if (deleting.value) return;
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
onMounted(load);
</script>

<template>
    <div class="reports-page">
        <div class="toolbar">
            <div><h1>Входящие отчёты</h1><p>Создавайте формы отчётов и настраивайте правила чтения Excel.</p></div>
            <div class="actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary" :loading="loading" :disabled="deleting" @click="load" />
                <Button label="Создать отчёт" icon="pi pi-plus" :disabled="deleting" @click="router.push('/incoming-reports/new')" />
            </div>
        </div>
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <DataTable :value="reports" :loading="loading" data-key="id" striped-rows show-gridlines lazy paginator
                   :first="first" :rows="rows" :total-records="total" :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   current-page-report-template="{first}–{last} из {totalRecords}"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport">
            <template #empty>{{ error ? 'Не удалось загрузить отчёты. Нажмите «Обновить».' : 'Создайте первый входящий отчёт.' }}</template>
            <Column field="codeReportIn" header="Код" />
            <Column field="nameReportIn" header="Наименование" />
            <Column field="typePeriod.nameTypePeriod" header="Тип периода" />
            <Column field="typeEnterprise.nameTypeEnterprise" header="Тип предприятия" />
            <Column header="Строки Excel"><template #body="{ data }">{{ data.indexRowScanBegin }}–{{ data.indexRowScanEnd }}</template></Column>
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
h1 { margin: 0; font-size: 23px; color: var(--app-brand); }
p { color: var(--p-text-muted-color); }
.reports-page :deep(.p-datatable-table-container) { overflow-x: auto; }
</style>
