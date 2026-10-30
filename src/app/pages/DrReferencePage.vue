<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import type { DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import type { DrReference, DrReferenceRequest } from '@/core/models/dr-reference.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drReferenceService } from '@/core/services/dr-reference.service';

// Состояние страницы. ref автоматически обновляет разметку при изменении .value.
const references = ref<DrReference[]>([]);
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
const form = ref<DrReferenceRequest>({ codeReference: '', nameReference: '' });
const attempted = ref(false);
const saving = ref(false);
const formError = ref('');

// Подтверждение удаления хранит отдельную выбранную запись.
const deleteVisible = ref(false);
const deleteTarget = ref<DrReference | null>(null);
const deleting = ref(false);
const deleteError = ref('');

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}

async function loadReferences() {
    const version = ++loadVersion;
    loading.value = true;
    pageError.value = '';
    try {
        let requestedPage = Math.floor(first.value / pageSize.value);
        let result = await drReferenceService.findPage(requestedPage, pageSize.value);
        if (version !== loadVersion) return false;
        // После удаления последней строки страницы возвращаемся на существующую страницу.
        while (requestedPage > 0 && requestedPage >= result.totalPages) {
            requestedPage = Math.max(0, result.totalPages - 1);
            result = await drReferenceService.findPage(requestedPage, pageSize.value);
            if (version !== loadVersion) return false;
        }
        if (!Array.isArray(result.content)) throw new Error('Ожидалась страница справочников от backend.');
        references.value = result.content;
        totalRecords.value = result.totalElements;
        first.value = result.page * result.size;
        return true;
    } catch (error) {
        if (version !== loadVersion) return false;
        // Ошибку показываем отдельно: она не должна выглядеть как пустой справочник.
        pageError.value = errorMessage(error);
        references.value = [];
        return false;
    } finally {
        if (version === loadVersion) loading.value = false;
    }
}

async function changePage(event: DataTablePageEvent) {
    if (saving.value || deleting.value || movingId.value !== null) return;
    first.value = event.first;
    pageSize.value = event.rows;
    await loadReferences();
}

function openCreate() {
    editingId.value = null;
    form.value = { codeReference: '', nameReference: '' };
    attempted.value = false;
    formError.value = '';
    successMessage.value = '';
    editorVisible.value = true;
}

function openEdit(reference: DrReference) {
    editingId.value = reference.id;
    // Копируем поля: ввод в диалоге не меняет строку таблицы до сохранения.
    form.value = {
        codeReference: reference.codeReference,
        nameReference: reference.nameReference,
    };
    attempted.value = false;
    formError.value = '';
    successMessage.value = '';
    editorVisible.value = true;
}

async function saveReference() {
    if (saving.value) return;
    attempted.value = true;
    formError.value = '';

    const data: DrReferenceRequest = {
        codeReference: form.value.codeReference.trim(),
        nameReference: form.value.nameReference.trim(),
    };
    if (!data.codeReference || !data.nameReference) return;
    if (data.codeReference.length > 50 || data.nameReference.length > 300) {
        formError.value = 'Код — до 50 символов, наименование — до 300 символов.';
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            await drReferenceService.create(data);
            successMessage.value = 'Справочник создан.';
        } else {
            await drReferenceService.update(editingId.value, data);
            successMessage.value = 'Справочник обновлён.';
        }
        editorVisible.value = false;
        await loadReferences();
    } catch (error) {
        formError.value = errorMessage(error);
    } finally {
        saving.value = false;
    }
}

function openDelete(reference: DrReference) {
    deleteTarget.value = reference;
    deleteError.value = '';
    successMessage.value = '';
    deleteVisible.value = true;
}

async function deleteReference() {
    if (!deleteTarget.value || deleting.value) return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await drReferenceService.remove(deleteTarget.value.id);
        deleteVisible.value = false;
        deleteTarget.value = null;
        successMessage.value = 'Справочник удалён.';
        await loadReferences();
    } catch (error) {
        deleteError.value = errorMessage(error);
    } finally {
        deleting.value = false;
    }
}

// Соседнюю запись определяет backend по полному актуальному списку.
async function moveReference(reference: DrReference, direction: 'up' | 'down') {
    if (movingId.value !== null || loading.value || saving.value || deleting.value) return;
    movingId.value = reference.id;
    pageError.value = '';
    successMessage.value = '';
    const currentIndex = first.value + references.value.findIndex(item => item.id === reference.id);
    try {
        if (direction === 'up') {
            await drReferenceService.moveUp(reference.id);
        } else {
            await drReferenceService.moveDown(reference.id);
        }
        // Перестановка через границу страницы должна оставить перемещённую запись на экране.
        const targetIndex = Math.max(0, Math.min(totalRecords.value - 1,
            currentIndex + (direction === 'up' ? -1 : 1)));
        first.value = Math.floor(targetIndex / pageSize.value) * pageSize.value;
        const loaded = await loadReferences();
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
onMounted(loadReferences);
</script>

<template>
    <div class="reference-page">
        <div class="reference-toolbar">
            <h1>Справочники</h1>
            <div class="reference-actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary"
                        :loading="loading" :disabled="saving || deleting || movingId !== null" @click="loadReferences" />
                <Button label="Добавить" icon="pi pi-plus"
                        :disabled="loading || saving || deleting || movingId !== null" @click="openCreate" />
            </div>
        </div>

        <Message v-if="successMessage" severity="success" :closable="false">{{ successMessage }}</Message>
        <Message v-if="pageError" severity="error" :closable="false">{{ pageError }}</Message>

        <DataTable :value="references" :loading="loading" data-key="id" striped-rows show-gridlines
                   lazy paginator :first="first" :rows="pageSize" :total-records="totalRecords"
                   :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                   current-page-report-template="{first}–{last} из {totalRecords}"
                   :table-style="{ minWidth: '42rem' }">
            <template #empty>
                {{ pageError ? 'Не удалось обновить данные. Нажмите «Обновить» после устранения ошибки.' : 'Справочники пока не добавлены.' }}
            </template>
            <Column field="id" header="ID" style="width: 6rem" />
            <Column field="codeReference" header="Код" style="width: 10rem" />
            <Column field="nameReference" header="Наименование" />
            <Column header="Действия" style="width: 9rem">
                <template #body="{ data }">
                    <div class="reference-actions">
                        <Button icon="pi pi-pencil" severity="secondary" text
                                :aria-label="`Редактировать ${data.codeReference}`" title="Редактировать"
                                :disabled="loading || saving || deleting || movingId !== null" @click="openEdit(data)" />
                        <Button icon="pi pi-trash" severity="danger" text
                                :aria-label="`Удалить ${data.codeReference}`" title="Удалить"
                                :disabled="loading || saving || deleting || movingId !== null" @click="openDelete(data)" />
                    </div>
                </template>
            </Column>
            <Column header="Порядок" style="width: 6rem">
                <template #body="{ data }">
                    <div class="reference-order-actions">
                        <Button icon="pi pi-arrow-up" text severity="secondary"
                                :aria-label="`Сдвинуть вверх ${data.codeReference}`" title="Сдвинуть вверх"
                                :disabled="loading || saving || deleting || movingId !== null || (first === 0 && references[0]?.id === data.id)"
                                @click="moveReference(data, 'up')" />
                        <Button icon="pi pi-arrow-down" text severity="secondary"
                                :aria-label="`Сдвинуть вниз ${data.codeReference}`" title="Сдвинуть вниз"
                                :disabled="loading || saving || deleting || movingId !== null || (first + references.length >= totalRecords && references[references.length - 1]?.id === data.id)"
                                @click="moveReference(data, 'down')" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="editorVisible" modal
                :header="editingId === null ? 'Новый справочник' : 'Редактирование справочника'"
                :style="{ width: '30rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!saving" :close-on-escape="!saving" :draggable="false">
            <form id="reference-form" class="reference-form" novalidate @submit.prevent="saveReference">
                <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
                <div class="reference-field">
                    <label for="reference-code">Код <span aria-hidden="true">*</span></label>
                    <InputText id="reference-code" v-model="form.codeReference" :maxlength="50" autofocus
                               autocomplete="off" :disabled="saving" aria-required="true"
                               :invalid="attempted && !form.codeReference.trim()"
                               aria-describedby="reference-code-help" />
                    <small id="reference-code-help" :class="{ 'reference-field-error': attempted && !form.codeReference.trim() }">
                        {{ attempted && !form.codeReference.trim() ? 'Введите код.' : 'До 50 символов.' }}
                    </small>
                </div>
                <div class="reference-field">
                    <label for="reference-name">Наименование <span aria-hidden="true">*</span></label>
                    <InputText id="reference-name" v-model="form.nameReference" :maxlength="300"
                               :disabled="saving" aria-required="true"
                               :invalid="attempted && !form.nameReference.trim()"
                               aria-describedby="reference-name-help" />
                    <small id="reference-name-help" :class="{ 'reference-field-error': attempted && !form.nameReference.trim() }">
                        {{ attempted && !form.nameReference.trim() ? 'Введите наименование.' : 'До 300 символов.' }}
                    </small>
                </div>
            </form>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="saving" @click="editorVisible = false" />
                <Button label="Сохранить" icon="pi pi-check" type="submit" form="reference-form" :loading="saving" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteVisible" header="Удаление справочника" modal
                :style="{ width: '30rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!deleting" :close-on-escape="!deleting" :draggable="false">
            <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>
            <p>Удалить справочник «{{ deleteTarget?.nameReference }}» ({{ deleteTarget?.codeReference }})?</p>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="deleting" @click="deleteVisible = false" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deleteReference" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped lang="scss">
.reference-page { display: flex; flex-direction: column; gap: 16px; }
.reference-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 23px; font-weight: 600; color: var(--app-brand); }
.reference-actions { display: flex; align-items: center; gap: 8px; }
.reference-order-actions { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.reference-order-actions :deep(.p-button) { width: 2rem; height: 1.7rem; padding: 0; }
.reference-form { display: flex; flex-direction: column; gap: 20px; }
.reference-field { display: flex; flex-direction: column; gap: 6px; }
.reference-field label { font-weight: 600; }
.reference-field small { color: var(--p-text-muted-color); }
.reference-field .reference-field-error { color: var(--p-red-600); }
.reference-page :deep(.p-datatable-table-container) { overflow-x: auto; }
</style>
