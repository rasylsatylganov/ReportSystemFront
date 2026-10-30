<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import type { DrPeriod, DrPeriodRequest } from '@/core/models/dr-period.model';
import type { DrTypePeriod } from '@/core/models/dr-type-period.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drPeriodService } from '@/core/services/dr-period.service';
import { drTypePeriodService } from '@/core/services/dr-type-period.service';

const periods = ref<DrPeriod[]>([]);
const types = ref<DrTypePeriod[]>([]);
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
const form = ref({ typePeriodId: null as number | null, codePeriod: '', namePeriod: '',
    dateBegin: null as Date | null, dateEnd: null as Date | null });
const attempted = ref(false);
const saving = ref(false);
const formError = ref('');
const deleteVisible = ref(false);
const deleteTarget = ref<DrPeriod | null>(null);
const deleting = ref(false);
const movingId = ref<number | null>(null);
const deleteError = ref('');
const busy = computed(() => saving.value || deleting.value || movingId.value !== null);
const invalidRange = computed(() => !!form.value.dateBegin && !!form.value.dateEnd
    && form.value.dateEnd < form.value.dateBegin);
const typeOptions = computed(() => {
    const options = [...types.value];
    // Сохраняем выбранное название и при удалении типа другим пользователем.
    const current = periods.value.find(item => item.id === editingId.value)?.typePeriod;
    if (current && !options.some(item => item.id === current.id)) options.push(current);
    return options;
});

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}

function toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year!, month! - 1, day!);
}

function displayDate(value: string): string {
    return value.split('-').reverse().join('.');
}

async function loadTypes() {
    typesLoading.value = true;
    typesError.value = '';
    try {
        const result: DrTypePeriod[] = [];
        let page = 0;
        while (true) {
            const response = await drTypePeriodService.findPage(page, 100);
            if (!Array.isArray(response.content)) throw new Error('Не удалось прочитать типы периодов.');
            result.push(...response.content);
            if (++page >= response.totalPages) break;
        }
        types.value = result;
        if (!result.some(type => type.id === selectedType.value)) {
            selectedType.value = result[0]?.id ?? null;
            first.value = 0;
        }
        return true;
    } catch (error) {
        typesError.value = errorMessage(error);
        return false;
    } finally {
        typesLoading.value = false;
    }
}

async function loadPeriods() {
    const version = ++loadVersion;
    const filter = selectedType.value;
    if (filter === null) {
        periods.value = [];
        totalRecords.value = 0;
        first.value = 0;
        loading.value = false;
        return false;
    }
    loading.value = true;
    pageError.value = '';
    try {
        let page = Math.floor(first.value / pageSize.value);
        let result = await drPeriodService.findPage(page, pageSize.value, filter);
        if (version !== loadVersion) return;
        while (page > 0 && page >= result.totalPages) {
            page = Math.max(0, result.totalPages - 1);
            result = await drPeriodService.findPage(page, pageSize.value, filter);
            if (version !== loadVersion) return;
        }
        if (!Array.isArray(result.content)) throw new Error('Ожидалась страница периодов от backend.');
        periods.value = result.content;
        totalRecords.value = result.totalElements;
        first.value = result.page * result.size;
        return true;
    } catch (error) {
        if (version !== loadVersion) return;
        pageError.value = errorMessage(error);
        periods.value = [];
        totalRecords.value = 0;
    } finally {
        if (version === loadVersion) loading.value = false;
    }
}

async function refresh() {
    ++loadVersion;
    if (await loadTypes()) {
        await loadPeriods();
    } else {
        periods.value = [];
        totalRecords.value = 0;
        loading.value = false;
    }
}

async function changeFilter() {
    first.value = 0;
    successMessage.value = '';
    await loadPeriods();
}

async function changePage(event: DataTablePageEvent) {
    if (busy.value) return;
    first.value = event.first;
    pageSize.value = event.rows;
    await loadPeriods();
}

function openEditor(period?: DrPeriod) {
    editingId.value = period?.id ?? null;
    form.value = {
        typePeriodId: period?.typePeriod.id ?? selectedType.value,
        codePeriod: period?.codePeriod ?? '',
        namePeriod: period?.namePeriod ?? '',
        dateBegin: period ? fromIsoDate(period.dateBegin) : null,
        dateEnd: period ? fromIsoDate(period.dateEnd) : null,
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
    const value = form.value;
    if (!value.typePeriodId || !value.codePeriod.trim() || !value.namePeriod.trim()
        || !value.dateBegin || !value.dateEnd || invalidRange.value) return;
    if (value.codePeriod.trim().length > 20 || value.namePeriod.trim().length > 200) {
        formError.value = 'Код — до 20 символов, наименование — до 200 символов.';
        return;
    }
    const data: DrPeriodRequest = {
        typePeriod: { id: value.typePeriodId },
        codePeriod: value.codePeriod.trim(), namePeriod: value.namePeriod.trim(),
        dateBegin: toIsoDate(value.dateBegin), dateEnd: toIsoDate(value.dateEnd),
    };
    saving.value = true;
    try {
        if (editingId.value === null) await drPeriodService.create(data);
        else await drPeriodService.update(editingId.value, data);
        successMessage.value = editingId.value === null ? 'Период создан.' : 'Период обновлён.';
        editorVisible.value = false;
        await loadPeriods();
    } catch (error) {
        formError.value = errorMessage(error);
    } finally {
        saving.value = false;
    }
}

function openDelete(period: DrPeriod) {
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
        await drPeriodService.remove(deleteTarget.value.id);
        deleteVisible.value = false;
        deleteTarget.value = null;
        successMessage.value = 'Период удалён.';
        await loadPeriods();
    } catch (error) {
        deleteError.value = errorMessage(error);
    } finally {
        deleting.value = false;
    }
}

async function movePeriod(period: DrPeriod, direction: 'up' | 'down') {
    if (busy.value || loading.value) return;
    movingId.value = period.id;
    pageError.value = '';
    successMessage.value = '';
    const currentIndex = first.value + periods.value.findIndex(item => item.id === period.id);
    try {
        await drPeriodService.move(period.id, direction, selectedType.value);
        const targetIndex = Math.max(0, Math.min(totalRecords.value - 1,
            currentIndex + (direction === 'up' ? -1 : 1)));
        first.value = Math.floor(targetIndex / pageSize.value) * pageSize.value;
        if (await loadPeriods()) successMessage.value = 'Порядок изменён.';
    } catch (error) {
        pageError.value = errorMessage(error);
    } finally {
        movingId.value = null;
    }
}

onMounted(refresh);
</script>

<template>
    <div class="period-page">
        <div class="period-toolbar">
            <div><h1>Периоды</h1><p class="subtitle">Календарные интервалы по типам периодов</p></div>
            <div class="period-actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary"
                        :loading="loading || typesLoading" :disabled="busy" @click="refresh" />
                <Button label="Добавить период" icon="pi pi-plus"
                        :disabled="loading || typesLoading || busy || !!typesError || !types.length" @click="openEditor()" />
            </div>
        </div>
        <Message v-if="successMessage" severity="success" :closable="false">{{ successMessage }}</Message>
        <Message v-if="pageError" severity="error" :closable="false">{{ pageError }}</Message>
        <Message v-if="typesError" severity="error" :closable="false">
            Не удалось загрузить типы периодов. {{ typesError }} Нажмите «Обновить» для повторной загрузки.
        </Message>
        <Message v-else-if="!typesLoading && !types.length" severity="info" :closable="false">
            Сначала добавьте <RouterLink to="/type-periods">тип периода</RouterLink>, затем создайте период.
        </Message>
        <div class="period-filter">
            <label for="period-filter">Тип периода</label>
            <Select input-id="period-filter" v-model="selectedType" :options="types"
                    option-label="nameTypePeriod" option-value="id" placeholder="Выберите тип периода"
                    filter :loading="typesLoading" :disabled="busy || typesLoading || !!typesError"
                    empty-filter-message="Типы не найдены" @change="changeFilter" />
        </div>
        <DataTable :value="periods" :loading="loading" data-key="id" striped-rows show-gridlines
                   lazy paginator :first="first" :rows="pageSize" :total-records="totalRecords"
                   :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                   paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                   current-page-report-template="{first}–{last} из {totalRecords}" :table-style="{ minWidth: '58rem' }">
            <template #empty>{{ pageError ? 'Не удалось загрузить периоды. Нажмите «Обновить».' : typesError ? 'Не удалось загрузить типы периодов. Нажмите «Обновить».' : selectedType ? 'Для выбранного типа периоды пока не добавлены.' : 'Сначала добавьте тип периода.' }}</template>
            <Column field="codePeriod" header="Код" />
            <Column field="namePeriod" header="Наименование" />
            <Column header="Дата начала"><template #body="{ data }">{{ displayDate(data.dateBegin) }}</template></Column>
            <Column header="Дата окончания"><template #body="{ data }">{{ displayDate(data.dateEnd) }}</template></Column>
            <Column header="Действия" style="width: 8rem">
                <template #body="{ data }"><div class="period-actions">
                    <Button icon="pi pi-pencil" text severity="secondary" title="Редактировать"
                            :aria-label="`Редактировать ${data.namePeriod}`" :disabled="loading || busy || typesLoading || !!typesError" @click="openEditor(data)" />
                    <Button icon="pi pi-trash" text severity="danger" title="Удалить"
                            :aria-label="`Удалить ${data.namePeriod}`" :disabled="loading || busy" @click="openDelete(data)" />
                </div></template>
            </Column>
            <Column header="Порядок" style="width: 6rem">
                <template #body="{ data }">
                    <div class="period-order-actions">
                        <Button icon="pi pi-arrow-up" text severity="secondary" title="Сдвинуть вверх"
                                :aria-label="`Сдвинуть вверх ${data.namePeriod}`"
                                :disabled="loading || busy || (first === 0 && periods[0]?.id === data.id)"
                                @click="movePeriod(data, 'up')" />
                        <Button icon="pi pi-arrow-down" text severity="secondary" title="Сдвинуть вниз"
                                :aria-label="`Сдвинуть вниз ${data.namePeriod}`"
                                :disabled="loading || busy || (first + periods.length >= totalRecords && periods[periods.length - 1]?.id === data.id)"
                                @click="movePeriod(data, 'down')" />
                    </div>
                </template>
            </Column>
        </DataTable>
        <Dialog v-model:visible="editorVisible" modal :header="editingId === null ? 'Новый период' : 'Редактирование периода'"
                :style="{ width: '38rem' }" :breakpoints="{ '640px': '95vw' }"
                :closable="!saving" :close-on-escape="!saving" :draggable="false">
            <form id="period-form" class="period-form" novalidate @submit.prevent="savePeriod">
                <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
                <div class="period-field">
                    <label for="period-type">Тип периода *</label>
                    <Select input-id="period-type" v-model="form.typePeriodId" :options="typeOptions"
                            option-label="nameTypePeriod" option-value="id" filter placeholder="Выберите тип периода"
                            :disabled="saving" :invalid="attempted && !form.typePeriodId" aria-required="true"
                            aria-describedby="period-type-help" empty-filter-message="Типы не найдены" />
                    <small id="period-type-help" :class="{ error: attempted && !form.typePeriodId }">{{ attempted && !form.typePeriodId ? 'Выберите тип периода.' : 'Тип определяет, к какой группе относится период.' }}</small>
                </div>
                <div class="period-field">
                    <label for="period-code">Код *</label>
                    <InputText id="period-code" v-model="form.codePeriod" :maxlength="20" :disabled="saving"
                               :invalid="attempted && !form.codePeriod.trim()" aria-required="true" aria-describedby="period-code-help" />
                    <small id="period-code-help" :class="{ error: attempted && !form.codePeriod.trim() }">{{ attempted && !form.codePeriod.trim() ? 'Введите код.' : 'До 20 символов. Код уникален в пределах типа периода.' }}</small>
                </div>
                <div class="period-field">
                    <label for="period-name">Наименование *</label>
                    <InputText id="period-name" v-model="form.namePeriod" :maxlength="200" :disabled="saving"
                               :invalid="attempted && !form.namePeriod.trim()" aria-required="true" aria-describedby="period-name-help" />
                    <small id="period-name-help" :class="{ error: attempted && !form.namePeriod.trim() }">{{ attempted && !form.namePeriod.trim() ? 'Введите наименование.' : 'До 200 символов, например «Январь 2026».' }}</small>
                </div>
                <div class="period-dates">
                    <div class="period-field">
                        <label for="period-begin">Дата начала *</label>
                        <DatePicker input-id="period-begin" v-model="form.dateBegin" date-format="dd.mm.yy" show-icon
                                    :manual-input="false" :disabled="saving" :invalid="attempted && !form.dateBegin" aria-required="true" />
                        <small v-if="attempted && !form.dateBegin" class="error">Выберите дату начала.</small>
                    </div>
                    <div class="period-field">
                        <label for="period-end">Дата окончания *</label>
                        <DatePicker input-id="period-end" v-model="form.dateEnd" date-format="dd.mm.yy" show-icon
                                    :manual-input="false" :disabled="saving" :min-date="form.dateBegin ?? undefined"
                                    :invalid="attempted && (!form.dateEnd || invalidRange)" aria-required="true" />
                        <small v-if="attempted && !form.dateEnd" class="error">Выберите дату окончания.</small>
                    </div>
                </div>
                <Message v-if="invalidRange" severity="error" :closable="false">Дата окончания не может быть раньше даты начала.</Message>
            </form>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="saving" @click="editorVisible = false" />
                <Button label="Сохранить" icon="pi pi-check" type="submit" form="period-form" :loading="saving" />
            </template>
        </Dialog>
        <Dialog v-model:visible="deleteVisible" header="Удаление периода" modal :style="{ width: '30rem' }"
                :breakpoints="{ '640px': '95vw' }" :closable="!deleting" :close-on-escape="!deleting" :draggable="false">
            <Message v-if="deleteError" severity="error" :closable="false">{{ deleteError }}</Message>
            <p>Удалить период «{{ deleteTarget?.namePeriod }}» ({{ deleteTarget?.codePeriod }})?</p>
            <template #footer>
                <Button label="Отмена" severity="secondary" :disabled="deleting" @click="deleteVisible = false" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deletePeriod" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped lang="scss">
.period-page, .period-form { display: flex; flex-direction: column; gap: 20px; }
.period-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 23px; font-weight: 600; color: var(--app-brand); }
.subtitle { margin: 6px 0 0; color: var(--p-text-muted-color); }
.period-actions { display: flex; align-items: center; gap: 8px; }
.period-order-actions { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.period-order-actions :deep(.p-button) { width: 2rem; height: 1.7rem; padding: 0; }
.period-filter, .period-field { display: flex; flex-direction: column; gap: 6px; }
.period-filter { max-width: 24rem; }
label { font-weight: 600; }
small { color: var(--p-text-muted-color); }
small.error { color: var(--p-red-600); }
.period-dates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.period-page :deep(.p-datatable-table-container) { overflow-x: auto; }
@media (max-width: 640px) { .period-dates { grid-template-columns: 1fr; } .period-actions { flex-wrap: wrap; } }
</style>
