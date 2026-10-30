<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import type { DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import type { DrTypePeriod, DrTypePeriodRequest } from '@/core/models/dr-type-period.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drTypePeriodService } from '@/core/services/dr-type-period.service';

// Состояние страницы. ref автоматически обновляет разметку при изменении .value.
const periods = ref<DrTypePeriod[]>([]);
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
const form = ref<DrTypePeriodRequest>({ codeTypePeriod: '', nameTypePeriod: '' });
const attempted = ref(false);
const saving = ref(false);
const formError = ref('');

// Подтверждение удаления хранит отдельную выбранную запись.
const deleteVisible = ref(false);
const deleteTarget = ref<DrTypePeriod | null>(null);
const deleting = ref(false);
const deleteError = ref('');

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}

async function loadPeriods() {
    const version = ++loadVersion;
    loading.value = true;
    pageError.value = '';
    try {
        let requestedPage = Math.floor(first.value / pageSize.value);
        let result = await drTypePeriodService.findPage(requestedPage, pageSize.value);
        if (version !== loadVersion) return false;
        // После удаления последней строки страницы возвращаемся на существующую страницу.
        while (requestedPage > 0 && requestedPage >= result.totalPages) {
            requestedPage = Math.max(0, result.totalPages - 1);
            result = await drTypePeriodService.findPage(requestedPage, pageSize.value);
            if (version !== loadVersion) return false;
        }
        if (!Array.isArray(result.content)) throw new Error('Ожидалась страница типов периодов от backend.');
        periods.value = result.content;
        totalRecords.value = result.totalElements;
        first.value = result.page * result.size;
        return true;
    } catch (error) {
        if (version !== loadVersion) return false;
        // Ошибку показываем отдельно: она не должна выглядеть как пустой справочник.
        pageError.value = errorMessage(error);
        periods.value = [];
        return false;
    } finally {
        if (version === loadVersion) loading.value = false;
    }
}

async function changePage(event: DataTablePageEvent) {
    if (saving.value || deleting.value || movingId.value !== null) return;
    first.value = event.first;
    pageSize.value = event.rows;
    await loadPeriods();
}

function openCreate() {
    editingId.value = null;
    form.value = { codeTypePeriod: '', nameTypePeriod: '' };
    attempted.value = false;
    formError.value = '';
    successMessage.value = '';
    editorVisible.value = true;
}

function openEdit(period: DrTypePeriod) {
    editingId.value = period.id;
    // Копируем поля: ввод в диалоге не меняет строку таблицы до сохранения.
    form.value = {
        codeTypePeriod: period.codeTypePeriod,
        nameTypePeriod: period.nameTypePeriod,
    };
    attempted.value = false;
    formError.value = '';
    successMessage.value = '';
    editorVisible.value = true;
}

async function savePeriod() {
    if (saving.value) return;
    attempted.value = true;
    formError.value = '';

    const data: DrTypePeriodRequest = {
        codeTypePeriod: form.value.codeTypePeriod.trim(),
        nameTypePeriod: form.value.nameTypePeriod.trim(),
    };
    if (!data.codeTypePeriod || !data.nameTypePeriod) return;
    if (data.codeTypePeriod.length > 3 || data.nameTypePeriod.length > 100) {
        formError.value = 'Код — до 3 символов, наименование — до 100 символов.';
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            await drTypePeriodService.create(data);
            successMessage.value = 'Тип периода создан.';
        } else {
            await drTypePeriodService.update(editingId.value, data);
            successMessage.value = 'Тип периода обновлён.';
        }
        editorVisible.value = false;
        await loadPeriods();
    } catch (error) {
        formError.value = errorMessage(error);
    } finally {
        saving.value = false;
    }
}

function openDelete(period: DrTypePeriod) {
    deleteTarget.value = period;
    deleteError.value = '';
    successMessage.value = '';
    deleteVisible.value = true;
}

async function deletePeriod() {
    if (!deleteTarget.value || deleting.value) return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await drTypePeriodService.remove(deleteTarget.value.id);
        deleteVisible.value = false;
        deleteTarget.value = null;
        successMessage.value = 'Тип периода удалён.';
        await loadPeriods();
    } catch (error) {
        deleteError.value = errorMessage(error);
    } finally {
        deleting.value = false;
    }
}

// Соседнюю запись определяет backend по полному актуальному списку.
async function movePeriod(period: DrTypePeriod, direction: 'up' | 'down') {
    if (movingId.value !== null || loading.value || saving.value || deleting.value) return;
    movingId.value = period.id;
    pageError.value = '';
    successMessage.value = '';
    const currentIndex = first.value + periods.value.findIndex(item => item.id === period.id);
    try {
        if (direction === 'up') {
            await drTypePeriodService.moveUp(period.id);
        } else {
            await drTypePeriodService.moveDown(period.id);
        }
        // Перестановка через границу страницы должна оставить перемещённую запись на экране.
        const targetIndex = Math.max(0, Math.min(totalRecords.value - 1,
            currentIndex + (direction === 'up' ? -1 : 1)));
        first.value = Math.floor(targetIndex / pageSize.value) * pageSize.value;
        const loaded = await loadPeriods();
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
onMounted(loadPeriods);
</script>

<template>
    <div class="period-page">
        <div class="period-toolbar">
            <h1>Типы периодов</h1>
            <div class="period-actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary"
                        :loading="loading" :disabled="saving || deleting || movingId !== null" @click="loadPeriods" />
                <Button label="Добавить" icon="pi pi-plus"
                        :disabled="loading || saving || deleting || movingId !== null" @click="openCreate" />
            </div>
        </div>

        <Message v-if="successMessage" severity="success" :closable="false">{{ successMessage }}</Message>
        <Message v-if="pageError" severity="error" :closable="false">{{ pageError }}</Message>

        <DataTable :value="periods" :loading="loading" data-key="id" striped-rows show-gridlines
                   lazy paginator :first="first" :rows="pageSize" :total-records="totalRecords"
                   :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                   current-page-report-template="{first}–{last} из {totalRecords}"
                   :table-style="{ minWidth: '42rem' }">
            <template #empty>
                {{ pageError ? 'Не удалось обновить данные. Нажмите «Обновить» после устранения ошибки.' : 'Типы периодов пока не добавлены.' }}
            </template>
            <Column field="id" header="ID" style="width: 6rem" />
            <Column field="codeTypePeriod" header="Код" style="width: 10rem" />
            <Column field="nameTypePeriod" header="Наименование" />
            <Column header="Действия" style="width: 9rem">
                <template #body="{ data }">
                    <div class="period-actions">
                        <Button icon="pi pi-pencil" severity="secondary" text
                                :aria-label="`Редактировать ${data.codeTypePeriod}`" title="Редактировать"
                                :disabled="loading || saving || deleting || movingId !== null" @click="openEdit(data)" />
                        <Button icon="pi pi-trash" severity="danger" text
                                :aria-label="`Удалить ${data.codeTypePeriod}`" title="Удалить"
                                :disabled="loading || saving || deleting || movingId !== null" @click="openDelete(data)" />
                    </div>
                </template>
            </Column>
            <Column header="Порядок" style="width: 6rem">
                <template #body="{ data }">
                    <div class="period-order-actions">
                        <Button icon="pi pi-arrow-up" text severity="secondary"
                                :aria-label="`Сдвинуть вверх ${data.codeTypePeriod}`" title="Сдвинуть вверх"
                                :disabled="loading || saving || deleting || movingId !== null || (first === 0 && periods[0]?.id === data.id)"
                                @click="movePeriod(data, 'up')" />
                        <Button icon="pi pi-arrow-down" text severity="secondary"
                                :aria-label="`Сдвинуть вниз ${data.codeTypePeriod}`" title="Сдвинуть вниз"
                                :disabled="loading || saving || deleting || movingId !== null || (first + periods.length >= totalRecords && periods[periods.length - 1]?.id === data.id)"
                                @click="movePeriod(data, 'down')" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="editorVisible" modal
                :header="editingId === null ? 'Новый тип периода' : 'Редактирование типа периода'"
                :style="{ width: '30rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!saving" :close-on-escape="!saving" :draggable="false">
            <form id="type-period-form" class="period-form" novalidate @submit.prevent="savePeriod">
                <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
                <div class="period-field">
                    <label for="period-code">Код <span aria-hidden="true">*</span></label>
                    <InputText id="period-code" v-model="form.codeTypePeriod" :maxlength="3" autofocus
                               autocomplete="off" :disabled="saving" aria-required="true"
                               :invalid="attempted && !form.codeTypePeriod.trim()"
                               aria-describedby="period-code-help" />
                    <small id="period-code-help" :class="{ 'period-field-error': attempted && !form.codeTypePeriod.trim() }">
                        {{ attempted && !form.codeTypePeriod.trim() ? 'Введите код.' : 'До 3 символов, например MON.' }}
                    </small>
                </div>
                <div class="period-field">
                    <label for="period-name">Наименование <span aria-hidden="true">*</span></label>
                    <InputText id="period-name" v-model="form.nameTypePeriod" :maxlength="100"
                               :disabled="saving" aria-required="true"
                               :invalid="attempted && !form.nameTypePeriod.trim()"
                               aria-describedby="period-name-help" />
                    <small id="period-name-help" :class="{ 'period-field-error': attempted && !form.nameTypePeriod.trim() }">
                        {{ attempted && !form.nameTypePeriod.trim() ? 'Введите наименование.' : 'До 100 символов.' }}
                    </small>
                </div>
            </form>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="saving" @click="editorVisible = false" />
                <Button label="Сохранить" icon="pi pi-check" type="submit" form="type-period-form" :loading="saving" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteVisible" header="Удаление типа периода" modal
                :style="{ width: '30rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!deleting" :close-on-escape="!deleting" :draggable="false">
            <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>
            <p>Удалить тип периода «{{ deleteTarget?.nameTypePeriod }}» ({{ deleteTarget?.codeTypePeriod }})?</p>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="deleting" @click="deleteVisible = false" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deletePeriod" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped lang="scss">
.period-page { display: flex; flex-direction: column; gap: 16px; }
.period-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 23px; font-weight: 600; color: var(--app-brand); }
.period-actions { display: flex; align-items: center; gap: 8px; }
.period-order-actions { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.period-order-actions :deep(.p-button) { width: 2rem; height: 1.7rem; padding: 0; }
.period-form { display: flex; flex-direction: column; gap: 20px; }
.period-field { display: flex; flex-direction: column; gap: 6px; }
.period-field label { font-weight: 600; }
.period-field small { color: var(--p-text-muted-color); }
.period-field .period-field-error { color: var(--p-red-600); }
.period-page :deep(.p-datatable-table-container) { overflow-x: auto; }
</style>
