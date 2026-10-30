<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import type { DrEnterprise, DrEnterpriseRequest } from '@/core/models/dr-enterprise.model';
import type { DrTypeEnterprise } from '@/core/models/dr-type-enterprise.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drEnterpriseService } from '@/core/services/dr-enterprise.service';
import { drTypeEnterpriseService } from '@/core/services/dr-type-enterprise.service';

const enterprises = ref<DrEnterprise[]>([]);
const types = ref<DrTypeEnterprise[]>([]);
const selectedType = ref<number | null>(null);
const loading = ref(false);
const typesLoading = ref(false);
const pageError = ref('');
const typesError = ref('');
const successMessage = ref('');
const first = ref(0);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const totalRecords = ref(0);
let loadVersion = 0;

const editorVisible = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ typeEnterpriseId: null as number | null, codeEnterprise: '', nameEnterprise: '' });
const attempted = ref(false);
const saving = ref(false);
const formError = ref('');
const deleteVisible = ref(false);
const deleteTarget = ref<DrEnterprise | null>(null);
const deleting = ref(false);
const movingId = ref<number | null>(null);
const deleteError = ref('');
const busy = computed(() => saving.value || deleting.value || movingId.value !== null);
const typeOptions = computed(() => {
    const options = [...types.value];
    // Сохраняем выбранное название и при удалении типа другим пользователем.
    const current = enterprises.value.find(item => item.id === editingId.value)?.typeEnterprise;
    if (current && !options.some(item => item.id === current.id)) options.push(current);
    return options;
});

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}

async function loadTypes() {
    typesLoading.value = true;
    typesError.value = '';
    try {
        const result: DrTypeEnterprise[] = [];
        let page = 0;
        while (true) {
            const response = await drTypeEnterpriseService.findPage(page, 100);
            if (!Array.isArray(response.content)) throw new Error('Не удалось прочитать типы предприятий.');
            result.push(...response.content);
            if (++page >= response.totalPages) break;
        }
        types.value = result;
    } catch (error) {
        typesError.value = errorMessage(error);
    } finally {
        typesLoading.value = false;
    }
}

async function loadEnterprises() {
    const version = ++loadVersion;
    const filter = selectedType.value;
    loading.value = true;
    pageError.value = '';
    try {
        let page = Math.floor(first.value / pageSize.value);
        let result = await drEnterpriseService.findPage(page, pageSize.value, filter);
        if (version !== loadVersion) return;
        while (page > 0 && page >= result.totalPages) {
            page = Math.max(0, result.totalPages - 1);
            result = await drEnterpriseService.findPage(page, pageSize.value, filter);
            if (version !== loadVersion) return;
        }
        if (!Array.isArray(result.content)) throw new Error('Ожидалась страница предприятий от backend.');
        enterprises.value = result.content;
        totalRecords.value = result.totalElements;
        first.value = result.page * result.size;
        return true;
    } catch (error) {
        if (version !== loadVersion) return;
        pageError.value = errorMessage(error);
        enterprises.value = [];
        totalRecords.value = 0;
    } finally {
        if (version === loadVersion) loading.value = false;
    }
}

async function refresh() {
    await Promise.all([loadTypes(), loadEnterprises()]);
}

async function changeFilter() {
    first.value = 0;
    successMessage.value = '';
    await loadEnterprises();
}

async function changePage(event: DataTablePageEvent) {
    if (busy.value) return;
    first.value = event.first;
    pageSize.value = event.rows;
    await loadEnterprises();
}

function openEditor(enterprise?: DrEnterprise) {
    editingId.value = enterprise?.id ?? null;
    form.value = {
        typeEnterpriseId: enterprise?.typeEnterprise.id ?? selectedType.value,
        codeEnterprise: enterprise?.codeEnterprise ?? '',
        nameEnterprise: enterprise?.nameEnterprise ?? '',
    };
    attempted.value = false;
    formError.value = '';
    successMessage.value = '';
    editorVisible.value = true;
}

async function saveEnterprise() {
    if (saving.value) return;
    attempted.value = true;
    formError.value = '';
    const value = form.value;
    if (!value.typeEnterpriseId || !value.codeEnterprise.trim() || !value.nameEnterprise.trim()) return;
    if (value.codeEnterprise.trim().length > 20 || value.nameEnterprise.trim().length > 300) {
        formError.value = 'Код — до 20 символов, наименование — до 300 символов.';
        return;
    }
    const data: DrEnterpriseRequest = {
        typeEnterprise: { id: value.typeEnterpriseId },
        codeEnterprise: value.codeEnterprise.trim(), nameEnterprise: value.nameEnterprise.trim(),
    };
    saving.value = true;
    try {
        if (editingId.value === null) await drEnterpriseService.create(data);
        else await drEnterpriseService.update(editingId.value, data);
        successMessage.value = editingId.value === null ? 'Предприятие создано.' : 'Предприятие обновлено.';
        editorVisible.value = false;
        await loadEnterprises();
    } catch (error) {
        formError.value = errorMessage(error);
    } finally {
        saving.value = false;
    }
}

function openDelete(enterprise: DrEnterprise) {
    deleteTarget.value = enterprise;
    deleteError.value = '';
    successMessage.value = '';
    deleteVisible.value = true;
}

async function deleteEnterprise() {
    if (!deleteTarget.value || deleting.value) return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await drEnterpriseService.remove(deleteTarget.value.id);
        deleteVisible.value = false;
        deleteTarget.value = null;
        successMessage.value = 'Предприятие удалено.';
        await loadEnterprises();
    } catch (error) {
        deleteError.value = errorMessage(error);
    } finally {
        deleting.value = false;
    }
}

async function moveEnterprise(enterprise: DrEnterprise, direction: 'up' | 'down') {
    if (busy.value || loading.value) return;
    movingId.value = enterprise.id;
    pageError.value = '';
    successMessage.value = '';
    const currentIndex = first.value + enterprises.value.findIndex(item => item.id === enterprise.id);
    try {
        await drEnterpriseService.move(enterprise.id, direction, selectedType.value);
        const targetIndex = Math.max(0, Math.min(totalRecords.value - 1,
            currentIndex + (direction === 'up' ? -1 : 1)));
        first.value = Math.floor(targetIndex / pageSize.value) * pageSize.value;
        if (await loadEnterprises()) successMessage.value = 'Порядок изменён.';
    } catch (error) {
        pageError.value = errorMessage(error);
    } finally {
        movingId.value = null;
    }
}

onMounted(refresh);
</script>

<template>
    <div class="enterprise-page">
        <div class="enterprise-toolbar">
            <div><h1>Предприятия</h1><p class="subtitle">Предприятия по типам организаций</p></div>
            <div class="enterprise-actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary"
                        :loading="loading || typesLoading" :disabled="busy" @click="refresh" />
                <Button label="Добавить предприятие" icon="pi pi-plus"
                        :disabled="loading || typesLoading || busy || !!typesError || !types.length" @click="openEditor()" />
            </div>
        </div>
        <Message v-if="successMessage" severity="success" :closable="false">{{ successMessage }}</Message>
        <Message v-if="pageError" severity="error" :closable="false">{{ pageError }}</Message>
        <Message v-if="typesError" severity="error" :closable="false">
            Не удалось загрузить типы предприятий. {{ typesError }} Нажмите «Обновить» для повторной загрузки.
        </Message>
        <Message v-else-if="!typesLoading && !types.length" severity="info" :closable="false">
            Сначала добавьте <RouterLink to="/type-enterprises">тип предприятия</RouterLink>, затем создайте предприятие.
        </Message>
        <div class="enterprise-filter">
            <label for="enterprise-filter">Тип предприятия</label>
            <Select input-id="enterprise-filter" v-model="selectedType" :options="types"
                    option-label="nameTypeEnterprise" option-value="id" placeholder="Все типы"
                    filter show-clear :loading="typesLoading" :disabled="busy || typesLoading || !!typesError"
                    empty-filter-message="Типы не найдены" @change="changeFilter" />
        </div>
        <DataTable :value="enterprises" :loading="loading" data-key="id" striped-rows show-gridlines
                   lazy paginator :first="first" :rows="pageSize" :total-records="totalRecords"
                   :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                   current-page-report-template="{first}–{last} из {totalRecords}" :table-style="{ minWidth: '48rem' }">
            <template #empty>{{ pageError ? 'Не удалось загрузить предприятия. Нажмите «Обновить».' : selectedType ? 'Для выбранного типа предприятия пока не добавлены.' : 'Предприятия пока не добавлены.' }}</template>
            <Column header="Тип предприятия"><template #body="{ data }"><Tag :value="data.typeEnterprise.nameTypeEnterprise" severity="secondary" /></template></Column>
            <Column field="codeEnterprise" header="Код" />
            <Column field="nameEnterprise" header="Наименование" />
            <Column header="Действия" style="width: 8rem">
                <template #body="{ data }"><div class="enterprise-actions">
                    <Button icon="pi pi-pencil" text severity="secondary" title="Редактировать"
                            :aria-label="`Редактировать ${data.nameEnterprise}`" :disabled="loading || busy || typesLoading || !!typesError" @click="openEditor(data)" />
                    <Button icon="pi pi-trash" text severity="danger" title="Удалить"
                            :aria-label="`Удалить ${data.nameEnterprise}`" :disabled="loading || busy" @click="openDelete(data)" />
                </div></template>
            </Column>
            <Column header="Порядок" style="width: 6rem">
                <template #body="{ data }">
                    <div class="enterprise-order-actions">
                        <Button icon="pi pi-arrow-up" text severity="secondary" title="Сдвинуть вверх"
                                :aria-label="`Сдвинуть вверх ${data.nameEnterprise}`"
                                :disabled="loading || busy || (first === 0 && enterprises[0]?.id === data.id)"
                                @click="moveEnterprise(data, 'up')" />
                        <Button icon="pi pi-arrow-down" text severity="secondary" title="Сдвинуть вниз"
                                :aria-label="`Сдвинуть вниз ${data.nameEnterprise}`"
                                :disabled="loading || busy || (first + enterprises.length >= totalRecords && enterprises[enterprises.length - 1]?.id === data.id)"
                                @click="moveEnterprise(data, 'down')" />
                    </div>
                </template>
            </Column>
        </DataTable>
        <Dialog v-model:visible="editorVisible" modal :header="editingId === null ? 'Новое предприятие' : 'Редактирование предприятия'"
                :style="{ width: '38rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!saving" :close-on-escape="!saving" :draggable="false">
            <form id="enterprise-form" class="enterprise-form" novalidate @submit.prevent="saveEnterprise">
                <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
                <div class="enterprise-field">
                    <label for="enterprise-type">Тип предприятия *</label>
                    <Select input-id="enterprise-type" v-model="form.typeEnterpriseId" :options="typeOptions"
                            option-label="nameTypeEnterprise" option-value="id" filter placeholder="Выберите тип предприятия"
                            :disabled="saving" :invalid="attempted && !form.typeEnterpriseId" aria-required="true"
                            aria-describedby="enterprise-type-help" empty-filter-message="Типы не найдены" />
                    <small id="enterprise-type-help" :class="{ error: attempted && !form.typeEnterpriseId }">{{ attempted && !form.typeEnterpriseId ? 'Выберите тип предприятия.' : 'Тип определяет, к какой группе относится предприятие.' }}</small>
                </div>
                <div class="enterprise-field">
                    <label for="enterprise-code">Код *</label>
                    <InputText id="enterprise-code" v-model="form.codeEnterprise" :maxlength="20" :disabled="saving"
                               :invalid="attempted && !form.codeEnterprise.trim()" aria-required="true" aria-describedby="enterprise-code-help" />
                    <small id="enterprise-code-help" :class="{ error: attempted && !form.codeEnterprise.trim() }">{{ attempted && !form.codeEnterprise.trim() ? 'Введите код.' : 'До 20 символов. Код уникален во всём справочнике.' }}</small>
                </div>
                <div class="enterprise-field">
                    <label for="enterprise-name">Наименование *</label>
                    <InputText id="enterprise-name" v-model="form.nameEnterprise" :maxlength="300" :disabled="saving"
                               :invalid="attempted && !form.nameEnterprise.trim()" aria-required="true" aria-describedby="enterprise-name-help" />
                    <small id="enterprise-name-help" :class="{ error: attempted && !form.nameEnterprise.trim() }">{{ attempted && !form.nameEnterprise.trim() ? 'Введите наименование.' : 'До 300 символов.' }}</small>
                </div>
            </form>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="saving" @click="editorVisible = false" />
                <Button label="Сохранить" icon="pi pi-check" type="submit" form="enterprise-form" :loading="saving" />
            </template>
        </Dialog>
        <Dialog v-model:visible="deleteVisible" header="Удаление предприятия" modal :style="{ width: '30rem' }"
                :breakpoints="{ '640px': '95vw' }" :closable="!deleting" :close-on-escape="!deleting" :draggable="false">
            <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>
            <p>Удалить предприятие «{{ deleteTarget?.nameEnterprise }}» ({{ deleteTarget?.codeEnterprise }})?</p>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="deleting" @click="deleteVisible = false" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deleteEnterprise" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped lang="scss">
.enterprise-page, .enterprise-form { display: flex; flex-direction: column; gap: 20px; }
.enterprise-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 23px; font-weight: 600; color: var(--app-brand); }
.subtitle { margin: 6px 0 0; color: var(--p-text-muted-color); }
.enterprise-actions { display: flex; align-items: center; gap: 8px; }
.enterprise-order-actions { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.enterprise-order-actions :deep(.p-button) { width: 2rem; height: 1.7rem; padding: 0; }
.enterprise-filter, .enterprise-field { display: flex; flex-direction: column; gap: 6px; }
.enterprise-filter { max-width: 24rem; }
label { font-weight: 600; }
small { color: var(--p-text-muted-color); }
small.error { color: var(--p-red-600); }
.enterprise-page :deep(.p-datatable-table-container) { overflow-x: auto; }
@media (max-width: 640px) { .enterprise-actions { flex-wrap: wrap; } }
</style>
