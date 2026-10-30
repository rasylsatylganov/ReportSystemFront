<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import type { DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import type { DrTypeEnterprise, DrTypeEnterpriseRequest } from '@/core/models/dr-type-enterprise.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drTypeEnterpriseService } from '@/core/services/dr-type-enterprise.service';

// Состояние страницы. ref автоматически обновляет разметку при изменении .value.
const enterprises = ref<DrTypeEnterprise[]>([]);
const loading = ref(false);
const pageError = ref('');
const movingId = ref<number | null>(null);
const first = ref(0);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const totalRecords = ref(0);
let loadVersion = 0;

const successMessage = ref('');

// Одна форма используется для создания и редактирования.
// editingId = null означает создание; число — редактирование записи с этим ID.
const editorVisible = ref(false);
const editingId = ref<number | null>(null);
const form = ref<DrTypeEnterpriseRequest>({ codeTypeEnterprise: '', nameTypeEnterprise: '' });
const attempted = ref(false);
const saving = ref(false);
const formError = ref('');

// Подтверждение удаления хранит отдельную выбранную запись.
const deleteVisible = ref(false);
const deleteTarget = ref<DrTypeEnterprise | null>(null);
const deleting = ref(false);
const deleteError = ref('');

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}

async function loadEnterprises() {
    const version = ++loadVersion;
    loading.value = true;
    pageError.value = '';
    try {
        let requestedPage = Math.floor(first.value / pageSize.value);
        let result = await drTypeEnterpriseService.findPage(requestedPage, pageSize.value);
        if (version !== loadVersion) return false;
        // После удаления последней строки страницы возвращаемся на существующую страницу.
        while (requestedPage > 0 && requestedPage >= result.totalPages) {
            requestedPage = Math.max(0, result.totalPages - 1);
            result = await drTypeEnterpriseService.findPage(requestedPage, pageSize.value);
            if (version !== loadVersion) return false;
        }
        if (!Array.isArray(result.content)) throw new Error('Ожидалась страница типов предприятий от backend.');
        enterprises.value = result.content;
        totalRecords.value = result.totalElements;
        first.value = result.page * result.size;
        return true;
    } catch (error) {
        if (version !== loadVersion) return false;
        // Ошибку показываем отдельно: она не должна выглядеть как пустой справочник.
        pageError.value = errorMessage(error);
        enterprises.value = [];
        return false;
    } finally {
        if (version === loadVersion) loading.value = false;
    }
}

async function changePage(event: DataTablePageEvent) {
    if (saving.value || deleting.value || movingId.value !== null) return;
    first.value = event.first;
    pageSize.value = event.rows;
    await loadEnterprises();
}

function openCreate() {
    editingId.value = null;
    form.value = { codeTypeEnterprise: '', nameTypeEnterprise: '' };
    attempted.value = false;
    formError.value = '';
    successMessage.value = '';
    editorVisible.value = true;
}

function openEdit(enterprise: DrTypeEnterprise) {
    editingId.value = enterprise.id;
    // Копируем поля: ввод в диалоге не меняет строку таблицы до сохранения.
    form.value = {
        codeTypeEnterprise: enterprise.codeTypeEnterprise,
        nameTypeEnterprise: enterprise.nameTypeEnterprise,
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

    const data: DrTypeEnterpriseRequest = {
        codeTypeEnterprise: form.value.codeTypeEnterprise.trim(),
        nameTypeEnterprise: form.value.nameTypeEnterprise.trim(),
    };
    if (!data.codeTypeEnterprise || !data.nameTypeEnterprise) return;
    if (data.codeTypeEnterprise.length > 50 || data.nameTypeEnterprise.length > 200) {
        formError.value = 'Код — до 50 символов, наименование — до 200 символов.';
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            await drTypeEnterpriseService.create(data);
            successMessage.value = 'Тип предприятия создан.';
        } else {
            await drTypeEnterpriseService.update(editingId.value, data);
            successMessage.value = 'Тип предприятия обновлён.';
        }
        editorVisible.value = false;
        await loadEnterprises();
    } catch (error) {
        formError.value = errorMessage(error);
    } finally {
        saving.value = false;
    }
}

function openDelete(enterprise: DrTypeEnterprise) {
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
        await drTypeEnterpriseService.remove(deleteTarget.value.id);
        deleteVisible.value = false;
        deleteTarget.value = null;
        successMessage.value = 'Тип предприятия удалён.';
        await loadEnterprises();
    } catch (error) {
        deleteError.value = errorMessage(error);
    } finally {
        deleting.value = false;
    }
}

// Соседнюю запись определяет backend по полному актуальному списку.
async function moveEnterprise(enterprise: DrTypeEnterprise, direction: 'up' | 'down') {
    if (movingId.value !== null || loading.value || saving.value || deleting.value) return;
    movingId.value = enterprise.id;
    pageError.value = '';
    successMessage.value = '';
    const currentIndex = first.value + enterprises.value.findIndex(item => item.id === enterprise.id);
    try {
        if (direction === 'up') {
            await drTypeEnterpriseService.moveUp(enterprise.id);
        } else {
            await drTypeEnterpriseService.moveDown(enterprise.id);
        }
        // Перестановка через границу страницы должна оставить перемещённую запись на экране.
        const targetIndex = Math.max(0, Math.min(totalRecords.value - 1,
            currentIndex + (direction === 'up' ? -1 : 1)));
        first.value = Math.floor(targetIndex / pageSize.value) * pageSize.value;
        const loaded = await loadEnterprises();
        if (loaded) {
            successMessage.value = 'Порядок изменён.';
        }
    } catch (error) {
        pageError.value = errorMessage(error);
    } finally {
        movingId.value = null;
    }
}

// Запрос списка выполняется после открытия страницы.
onMounted(loadEnterprises);
</script>

<template>
    <div class="enterprise-page">
        <div class="enterprise-toolbar">
            <h1>Типы предприятий</h1>
            <div class="enterprise-actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary"
                        :loading="loading" :disabled="saving || deleting || movingId !== null" @click="loadEnterprises" />
                <Button label="Добавить" icon="pi pi-plus"
                        :disabled="loading || saving || deleting || movingId !== null" @click="openCreate" />
            </div>
        </div>

        <Message v-if="successMessage" severity="success" :closable="false">{{ successMessage }}</Message>
        <Message v-if="pageError" severity="error" :closable="false">{{ pageError }}</Message>

        <DataTable :value="enterprises" :loading="loading" data-key="id" striped-rows show-gridlines
                   lazy paginator :first="first" :rows="pageSize" :total-records="totalRecords"
                   :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                   current-page-report-template="{first}–{last} из {totalRecords}"
                   :table-style="{ minWidth: '42rem' }">
            <template #empty>
                {{ pageError ? 'Не удалось обновить данные. Нажмите «Обновить» после устранения ошибки.' : 'Типы предприятий пока не добавлены.' }}
            </template>
            <Column field="id" header="ID" style="width: 6rem" />
            <Column field="codeTypeEnterprise" header="Код" style="width: 10rem" />
            <Column field="nameTypeEnterprise" header="Наименование" />
            <Column header="Действия" style="width: 9rem">
                <template #body="{ data }">
                    <div class="enterprise-actions">
                        <Button icon="pi pi-pencil" severity="secondary" text
                                :aria-label="`Редактировать ${data.codeTypeEnterprise}`" title="Редактировать"
                                :disabled="loading || saving || deleting || movingId !== null" @click="openEdit(data)" />
                        <Button icon="pi pi-trash" severity="danger" text
                                :aria-label="`Удалить ${data.codeTypeEnterprise}`" title="Удалить"
                                :disabled="loading || saving || deleting || movingId !== null" @click="openDelete(data)" />
                    </div>
                </template>
            </Column>
            <Column header="Порядок" style="width: 6rem">
                <template #body="{ data }">
                    <div class="enterprise-order-actions">
                        <Button icon="pi pi-arrow-up" text severity="secondary"
                                :aria-label="`Сдвинуть вверх ${data.codeTypeEnterprise}`" title="Сдвинуть вверх"
                                :disabled="loading || saving || deleting || movingId !== null || (first === 0 && enterprises[0]?.id === data.id)"
                                @click="moveEnterprise(data, 'up')" />
                        <Button icon="pi pi-arrow-down" text severity="secondary"
                                :aria-label="`Сдвинуть вниз ${data.codeTypeEnterprise}`" title="Сдвинуть вниз"
                                :disabled="loading || saving || deleting || movingId !== null || (first + enterprises.length >= totalRecords && enterprises[enterprises.length - 1]?.id === data.id)"
                                @click="moveEnterprise(data, 'down')" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="editorVisible" modal
                :header="editingId === null ? 'Новый тип предприятия' : 'Редактирование типа предприятия'"
                :style="{ width: '30rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!saving" :close-on-escape="!saving" :draggable="false">
            <form id="type-enterprise-form" class="enterprise-form" novalidate @submit.prevent="saveEnterprise">
                <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
                <div class="enterprise-field">
                    <label for="enterprise-code">Код <span aria-hidden="true">*</span></label>
                    <InputText id="enterprise-code" v-model="form.codeTypeEnterprise" :maxlength="50" autofocus
                               autocomplete="off" :disabled="saving" aria-required="true"
                               :invalid="attempted && !form.codeTypeEnterprise.trim()"
                               aria-describedby="enterprise-code-help" />
                    <small id="enterprise-code-help" :class="{ 'enterprise-field-error': attempted && !form.codeTypeEnterprise.trim() }">
                        {{ attempted && !form.codeTypeEnterprise.trim() ? 'Введите код.' : 'До 50 символов.' }}
                    </small>
                </div>
                <div class="enterprise-field">
                    <label for="enterprise-name">Наименование <span aria-hidden="true">*</span></label>
                    <InputText id="enterprise-name" v-model="form.nameTypeEnterprise" :maxlength="200"
                               :disabled="saving" aria-required="true"
                               :invalid="attempted && !form.nameTypeEnterprise.trim()"
                               aria-describedby="enterprise-name-help" />
                    <small id="enterprise-name-help" :class="{ 'enterprise-field-error': attempted && !form.nameTypeEnterprise.trim() }">
                        {{ attempted && !form.nameTypeEnterprise.trim() ? 'Введите наименование.' : 'До 200 символов.' }}
                    </small>
                </div>
            </form>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="saving" @click="editorVisible = false" />
                <Button label="Сохранить" icon="pi pi-check" type="submit" form="type-enterprise-form" :loading="saving" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteVisible" header="Удаление типа предприятия" modal
                :style="{ width: '30rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!deleting" :close-on-escape="!deleting" :draggable="false">
            <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>
            <p>Удалить тип предприятия «{{ deleteTarget?.nameTypeEnterprise }}» ({{ deleteTarget?.codeTypeEnterprise }})?</p>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="deleting" @click="deleteVisible = false" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deleteEnterprise" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped lang="scss">
.enterprise-page { display: flex; flex-direction: column; gap: 16px; }
.enterprise-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 23px; font-weight: 600; color: var(--app-brand); }
.enterprise-actions { display: flex; align-items: center; gap: 8px; }
.enterprise-order-actions { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.enterprise-order-actions :deep(.p-button) { width: 2rem; height: 1.7rem; padding: 0; }
.enterprise-form { display: flex; flex-direction: column; gap: 20px; }
.enterprise-field { display: flex; flex-direction: column; gap: 6px; }
.enterprise-field label { font-weight: 600; }
.enterprise-field small { color: var(--p-text-muted-color); }
.enterprise-field .enterprise-field-error { color: var(--p-red-600); }
.enterprise-page :deep(.p-datatable-table-container) { overflow-x: auto; }
</style>
