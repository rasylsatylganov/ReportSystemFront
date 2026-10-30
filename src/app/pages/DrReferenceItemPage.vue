<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import type { DrReferenceItem, DrReferenceItemRequest } from '@/core/models/dr-reference-item.model';
import type { DrReference } from '@/core/models/dr-reference.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drReferenceItemService } from '@/core/services/dr-reference-item.service';
import { drReferenceService } from '@/core/services/dr-reference.service';

const items = ref<DrReferenceItem[]>([]);
const references = ref<DrReference[]>([]);
const selectedReference = ref<number | null>(null);
const loading = ref(false);
const referencesLoading = ref(false);
const pageError = ref('');
const referencesError = ref('');
const successMessage = ref('');
const first = ref(0);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const totalRecords = ref(0);
let loadVersion = 0;

const editorVisible = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ referenceId: null as number | null, codeReferenceItem: '', nameReferenceItem: '' });
const attempted = ref(false);
const saving = ref(false);
const formError = ref('');
const deleteVisible = ref(false);
const deleteTarget = ref<DrReferenceItem | null>(null);
const deleting = ref(false);
const movingId = ref<number | null>(null);
const deleteError = ref('');
const busy = computed(() => saving.value || deleting.value || movingId.value !== null);
const referenceOptions = computed(() => {
    const options = [...references.value];
    // Сохраняем выбранное название и при удалении справочника другим пользователем.
    const current = items.value.find(item => item.id === editingId.value)?.reference;
    if (current && !options.some(item => item.id === current.id)) options.push(current);
    return options;
});

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}

async function loadReferences() {
    referencesLoading.value = true;
    referencesError.value = '';
    try {
        const result: DrReference[] = [];
        let page = 0;
        while (true) {
            const response = await drReferenceService.findPage(page, 100);
            if (!Array.isArray(response.content)) throw new Error('Не удалось прочитать справочники.');
            result.push(...response.content);
            if (++page >= response.totalPages) break;
        }
        references.value = result;
        if (!result.some(reference => reference.id === selectedReference.value)) {
            selectedReference.value = result[0]?.id ?? null;
            first.value = 0;
        }
        return true;
    } catch (error) {
        referencesError.value = errorMessage(error);
        return false;
    } finally {
        referencesLoading.value = false;
    }
}

async function loadReferenceItems() {
    const version = ++loadVersion;
    const filter = selectedReference.value;
    if (filter === null) {
        items.value = [];
        totalRecords.value = 0;
        first.value = 0;
        loading.value = false;
        return false;
    }
    loading.value = true;
    pageError.value = '';
    try {
        let page = Math.floor(first.value / pageSize.value);
        let result = await drReferenceItemService.findPage(page, pageSize.value, filter);
        if (version !== loadVersion) return;
        while (page > 0 && page >= result.totalPages) {
            page = Math.max(0, result.totalPages - 1);
            result = await drReferenceItemService.findPage(page, pageSize.value, filter);
            if (version !== loadVersion) return;
        }
        if (!Array.isArray(result.content)) throw new Error('Ожидалась страница значений справочника от backend.');
        items.value = result.content;
        totalRecords.value = result.totalElements;
        first.value = result.page * result.size;
        return true;
    } catch (error) {
        if (version !== loadVersion) return;
        pageError.value = errorMessage(error);
        items.value = [];
        totalRecords.value = 0;
    } finally {
        if (version === loadVersion) loading.value = false;
    }
}

async function refresh() {
    // Сначала выбираем справочник, затем запрашиваем только его значения.
    ++loadVersion;
    if (await loadReferences()) {
        await loadReferenceItems();
    } else {
        items.value = [];
        totalRecords.value = 0;
        loading.value = false;
    }
}

async function changeFilter() {
    first.value = 0;
    successMessage.value = '';
    await loadReferenceItems();
}

async function changePage(event: DataTablePageEvent) {
    if (busy.value) return;
    first.value = event.first;
    pageSize.value = event.rows;
    await loadReferenceItems();
}

function openEditor(item?: DrReferenceItem) {
    editingId.value = item?.id ?? null;
    form.value = {
        referenceId: item?.reference.id ?? selectedReference.value,
        codeReferenceItem: item?.codeReferenceItem ?? '',
        nameReferenceItem: item?.nameReferenceItem ?? '',
    };
    attempted.value = false;
    formError.value = '';
    successMessage.value = '';
    editorVisible.value = true;
}

async function saveReferenceItem() {
    if (saving.value) return;
    attempted.value = true;
    formError.value = '';
    const value = form.value;
    if (!value.referenceId || !value.codeReferenceItem.trim() || !value.nameReferenceItem.trim()) return;
    if (value.codeReferenceItem.trim().length > 100 || value.nameReferenceItem.trim().length > 300) {
        formError.value = 'Код — до 100 символов, наименование — до 300 символов.';
        return;
    }
    const data: DrReferenceItemRequest = {
        reference: { id: value.referenceId },
        codeReferenceItem: value.codeReferenceItem.trim(), nameReferenceItem: value.nameReferenceItem.trim(),
    };
    saving.value = true;
    try {
        if (editingId.value === null) await drReferenceItemService.create(data);
        else await drReferenceItemService.update(editingId.value, data);
        successMessage.value = editingId.value === null ? 'Значение справочника создано.' : 'Значение справочника обновлено.';
        editorVisible.value = false;
        await loadReferenceItems();
    } catch (error) {
        formError.value = errorMessage(error);
    } finally {
        saving.value = false;
    }
}

function openDelete(item: DrReferenceItem) {
    deleteTarget.value = item;
    deleteError.value = '';
    successMessage.value = '';
    deleteVisible.value = true;
}

async function deleteReferenceItem() {
    if (!deleteTarget.value || deleting.value) return;
    deleting.value = true;
    deleteError.value = '';
    try {
        await drReferenceItemService.remove(deleteTarget.value.id);
        deleteVisible.value = false;
        deleteTarget.value = null;
        successMessage.value = 'Значение справочника удалено.';
        await loadReferenceItems();
    } catch (error) {
        deleteError.value = errorMessage(error);
    } finally {
        deleting.value = false;
    }
}

async function moveReferenceItem(item: DrReferenceItem, direction: 'up' | 'down') {
    if (busy.value || loading.value) return;
    movingId.value = item.id;
    pageError.value = '';
    successMessage.value = '';
    const currentIndex = first.value + items.value.findIndex(row => row.id === item.id);
    try {
        await drReferenceItemService.move(item.id, direction, selectedReference.value);
        const targetIndex = Math.max(0, Math.min(totalRecords.value - 1,
            currentIndex + (direction === 'up' ? -1 : 1)));
        first.value = Math.floor(targetIndex / pageSize.value) * pageSize.value;
        if (await loadReferenceItems()) successMessage.value = 'Порядок изменён.';
    } catch (error) {
        pageError.value = errorMessage(error);
    } finally {
        movingId.value = null;
    }
}

onMounted(refresh);
</script>

<template>
    <div class="item-page">
        <div class="item-toolbar">
            <div><h1>Значения справочников</h1><p class="subtitle">Значения выбранного справочника</p></div>
            <div class="item-actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary"
                        :loading="loading || referencesLoading" :disabled="busy" @click="refresh" />
                <Button label="Добавить значение справочника" icon="pi pi-plus"
                        :disabled="loading || referencesLoading || busy || !!referencesError || !references.length" @click="openEditor()" />
            </div>
        </div>
        <Message v-if="successMessage" severity="success" :closable="false">{{ successMessage }}</Message>
        <Message v-if="pageError" severity="error" :closable="false">{{ pageError }}</Message>
        <Message v-if="referencesError" severity="error" :closable="false">
            Не удалось загрузить справочники. {{ referencesError }} Нажмите «Обновить» для повторной загрузки.
        </Message>
        <Message v-else-if="!referencesLoading && !references.length" severity="info" :closable="false">
            Сначала добавьте <RouterLink to="/references">справочник</RouterLink>, затем создайте значение справочника.
        </Message>
        <div class="item-filter">
            <label for="item-filter">Справочник</label>
            <Select input-id="item-filter" v-model="selectedReference" :options="references"
                    option-label="nameReference" option-value="id" placeholder="Выберите справочник"
                    filter :loading="referencesLoading" :disabled="busy || referencesLoading || !!referencesError"
                    empty-filter-message="Справочники не найдены" @change="changeFilter" />
        </div>
        <DataTable :value="items" :loading="loading" data-key="id" striped-rows show-gridlines
                   lazy paginator :first="first" :rows="pageSize" :total-records="totalRecords"
                   :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                   current-page-report-template="{first}–{last} из {totalRecords}" :table-style="{ minWidth: '48rem' }">
            <template #empty>{{ pageError ? 'Не удалось загрузить значения справочника. Нажмите «Обновить».' : referencesError ? 'Не удалось загрузить справочники. Нажмите «Обновить».' : selectedReference ? 'Для выбранного справочника значения пока не добавлены.' : 'Сначала добавьте справочник.' }}</template>
            <Column field="codeReferenceItem" header="Код" />
            <Column field="nameReferenceItem" header="Наименование" />
            <Column header="Действия" style="width: 8rem">
                <template #body="{ data }"><div class="item-actions">
                    <Button icon="pi pi-pencil" text severity="secondary" title="Редактировать"
                            :aria-label="`Редактировать ${data.nameReferenceItem}`" :disabled="loading || busy || referencesLoading || !!referencesError" @click="openEditor(data)" />
                    <Button icon="pi pi-trash" text severity="danger" title="Удалить"
                            :aria-label="`Удалить ${data.nameReferenceItem}`" :disabled="loading || busy" @click="openDelete(data)" />
                </div></template>
            </Column>
            <Column header="Порядок" style="width: 6rem">
                <template #body="{ data }">
                    <div class="item-order-actions">
                        <Button icon="pi pi-arrow-up" text severity="secondary" title="Сдвинуть вверх"
                                :aria-label="`Сдвинуть вверх ${data.nameReferenceItem}`"
                                :disabled="loading || busy || (first === 0 && items[0]?.id === data.id)"
                                @click="moveReferenceItem(data, 'up')" />
                        <Button icon="pi pi-arrow-down" text severity="secondary" title="Сдвинуть вниз"
                                :aria-label="`Сдвинуть вниз ${data.nameReferenceItem}`"
                                :disabled="loading || busy || (first + items.length >= totalRecords && items[items.length - 1]?.id === data.id)"
                                @click="moveReferenceItem(data, 'down')" />
                    </div>
                </template>
            </Column>
        </DataTable>
        <Dialog v-model:visible="editorVisible" modal :header="editingId === null ? 'Новое значение справочника' : 'Редактирование значения справочника'"
                :style="{ width: '38rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!saving" :close-on-escape="!saving" :draggable="false">
            <form id="item-form" class="item-form" novalidate @submit.prevent="saveReferenceItem">
                <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
                <div class="item-field">
                    <label for="item-type">Справочник *</label>
                    <Select input-id="item-type" v-model="form.referenceId" :options="referenceOptions"
                            option-label="nameReference" option-value="id" filter placeholder="Выберите справочник"
                            :disabled="saving" :invalid="attempted && !form.referenceId" aria-required="true"
                            aria-describedby="item-type-help" empty-filter-message="Справочники не найдены" />
                    <small id="item-type-help" :class="{ error: attempted && !form.referenceId }">{{ attempted && !form.referenceId ? 'Выберите справочник.' : 'Выберите справочник, которому принадлежит значение.' }}</small>
                </div>
                <div class="item-field">
                    <label for="item-code">Код *</label>
                    <InputText id="item-code" v-model="form.codeReferenceItem" :maxlength="100" :disabled="saving"
                               :invalid="attempted && !form.codeReferenceItem.trim()" aria-required="true" aria-describedby="item-code-help" />
                    <small id="item-code-help" :class="{ error: attempted && !form.codeReferenceItem.trim() }">{{ attempted && !form.codeReferenceItem.trim() ? 'Введите код.' : 'До 100 символов. Код уникален в пределах выбранного справочника.' }}</small>
                </div>
                <div class="item-field">
                    <label for="item-name">Наименование *</label>
                    <InputText id="item-name" v-model="form.nameReferenceItem" :maxlength="300" :disabled="saving"
                               :invalid="attempted && !form.nameReferenceItem.trim()" aria-required="true" aria-describedby="item-name-help" />
                    <small id="item-name-help" :class="{ error: attempted && !form.nameReferenceItem.trim() }">{{ attempted && !form.nameReferenceItem.trim() ? 'Введите наименование.' : 'До 300 символов.' }}</small>
                </div>
            </form>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="saving" @click="editorVisible = false" />
                <Button label="Сохранить" icon="pi pi-check" type="submit" form="item-form" :loading="saving" />
            </template>
        </Dialog>
        <Dialog v-model:visible="deleteVisible" header="Удаление значения справочника" modal :style="{ width: '30rem' }"
                :breakpoints="{ '640px': '95vw' }" :closable="!deleting" :close-on-escape="!deleting" :draggable="false">
            <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>
            <p>Удалить значение справочника «{{ deleteTarget?.nameReferenceItem }}» ({{ deleteTarget?.codeReferenceItem }})?</p>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="deleting" @click="deleteVisible = false" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deleteReferenceItem" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped lang="scss">
.item-page, .item-form { display: flex; flex-direction: column; gap: 20px; }
.item-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 23px; font-weight: 600; color: var(--app-brand); }
.subtitle { margin: 6px 0 0; color: var(--p-text-muted-color); }
.item-actions { display: flex; align-items: center; gap: 8px; }
.item-order-actions { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.item-order-actions :deep(.p-button) { width: 2rem; height: 1.7rem; padding: 0; }
.item-filter, .item-field { display: flex; flex-direction: column; gap: 6px; }
.item-filter { max-width: 24rem; }
label { font-weight: 600; }
small { color: var(--p-text-muted-color); }
small.error { color: var(--p-red-600); }
.item-page :deep(.p-datatable-table-container) { overflow-x: auto; }
@media (max-width: 640px) { .item-actions { flex-wrap: wrap; } }
</style>
