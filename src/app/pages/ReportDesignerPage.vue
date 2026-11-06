<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import ReportTemplatePreview from '@/app/components/ReportTemplatePreview.vue';
import type { DrReference } from '@/core/models/dr-reference.model';
import type { DrReferenceItem } from '@/core/models/dr-reference-item.model';
import type { DrTypePeriod } from '@/core/models/dr-type-period.model';
import type { DrTypeEnterprise } from '@/core/models/dr-type-enterprise.model';
import type { DesignerLookups, EditorField, EditorReference, ReportTemplate, ReportTemplateRequest } from '@/core/models/report-template.model';
import { drReferenceService } from '@/core/services/dr-reference.service';
import { drReferenceItemService } from '@/core/services/dr-reference-item.service';
import { drTypePeriodService } from '@/core/services/dr-type-period.service';
import { drTypeEnterpriseService } from '@/core/services/dr-type-enterprise.service';
import { allPages, reportTemplateService } from '@/core/services/report-template.service';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const ready = ref(false);
const readOnly = ref(false);
const readOnlyReason = ref<string | null>(null);
const saving = ref(false);
const checking = ref(false);
const error = ref('');
const success = ref('');
const showValidation = ref(false);
const lookups = ref<DesignerLookups>({ positions: [], fieldTypes: [] });
const dictionaries = ref<DrReference[]>([]);
const periodTypes = ref<DrTypePeriod[]>([]);
const enterpriseTypes = ref<DrTypeEnterprise[]>([]);
const dictionaryItems = ref<Record<number, DrReferenceItem[]>>({});
const itemLoading = ref(0);
const itemErrors = ref<Record<number, string>>({});
const pendingItems = new Map<number, Promise<void>>();
const header = ref({ code: '', name: '', typePeriodId: null as number | null, typeEnterpriseId: null as number | null,
    begin: 2 as number | null, end: 1000000 as number | null });
const references = ref<EditorReference[]>([]);
const fields = ref<EditorField[]>([]);
const revision = ref<string | null>(null);
const currentId = ref<number | null>(null);
let keySequence = 0;
let loadVersion = 0;
const selected = ref<{ kind: 'reference' | 'field'; key: number } | null>(null);
const selectedReference = computed(() => selected.value?.kind === 'reference'
    ? references.value.find(ref => ref.key === selected.value?.key) : undefined);
const selectedField = computed(() => selected.value?.kind === 'field'
    ? fields.value.find(field => field.key === selected.value?.key) : undefined);
const selectedParent = computed(() => references.value.find(ref => ref.key === selectedField.value?.parentKey));
const activeReference = computed(() => selectedReference.value ?? selectedParent.value);
const busy = computed(() => loading.value || saving.value || checking.value || !ready.value);
const disabled = computed(() => busy.value || readOnly.value);
const signature = computed(() => JSON.stringify({ header: header.value, references: references.value, fields: fields.value }));
const cleanSignature = ref('');
const dirty = computed(() => ready.value && signature.value !== cleanSignature.value);

function message(cause: unknown) { return cause instanceof Error ? cause.message : 'Не удалось выполнить операцию.'; }
function horizontal(ref: EditorReference) {
    const name = lookups.value.positions.find(position => position.id === ref.positionId)?.nameTypePosition.trim().toLowerCase() ?? '';
    return name.startsWith('горизонт') || name === 'horizontal';
}
function columnName(value: number | null): string {
    if (!value || value < 1 || value > 16384) return '—';
    let name = '';
    while (value > 0) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26); }
    return name;
}
function refName(ref: EditorReference) { return dictionaries.value.find(item => item.id === ref.referenceId)?.nameReference ?? 'Новый справочник'; }
function fieldName(field: EditorField) {
    const parent = references.value.find(ref => ref.key === field.parentKey);
    return dictionaryItems.value[parent?.referenceId ?? 0]?.find(item => item.id === field.itemId)?.nameReferenceItem ?? 'Новое поле';
}
function order<T extends { orderSort: number | null; key: number }>(items: T[]) {
    return [...items].sort((a, b) => (a.orderSort ?? Number.MAX_SAFE_INTEGER) - (b.orderSort ?? Number.MAX_SAFE_INTEGER) || a.key - b.key);
}
const orderedReferences = computed(() => order(references.value));
const verticalReferences = computed(() => orderedReferences.value.filter(ref => !horizontal(ref)));
const horizontalReferences = computed(() => orderedReferences.value.filter(horizontal));
function childFields(ref: EditorReference) { return order(fields.value.filter(field => field.parentKey === ref.key)); }
function availableReferences(ref: EditorReference) {
    return dictionaries.value.filter(item => item.id === ref.referenceId || !references.value.some(other => other.key !== ref.key && other.referenceId === item.id));
}
function availableItems(field: EditorField) {
    return (dictionaryItems.value[selectedParent.value?.referenceId ?? 0] ?? []).filter(item =>
        item.id === field.itemId || !fields.value.some(other => other.key !== field.key && other.itemId === item.id));
}
async function ensureItems(id: number) {
    if (dictionaryItems.value[id]) return;
    const pending = pendingItems.get(id);
    if (pending) return pending;
    const task = (async () => {
        itemLoading.value++;
        delete itemErrors.value[id];
        try { dictionaryItems.value[id] = await allPages((page, size) => drReferenceItemService.findPage(page, size, id)); }
        catch (cause) { itemErrors.value[id] = message(cause); throw cause; }
        finally { itemLoading.value--; pendingItems.delete(id); }
    })();
    pendingItems.set(id, task);
    return task;
}
async function loadReferenceItems() {
    try { await Promise.all(references.value.filter(ref => ref.referenceId).map(ref => ensureItems(ref.referenceId!))); }
    catch (cause) { error.value = message(cause); }
}
watch(() => references.value.map(ref => ref.referenceId), loadReferenceItems);

function applyTemplate(template: ReportTemplate) {
    readOnly.value = template.readOnly;
    readOnlyReason.value = template.readOnlyReason;
    const report = template.report;
    header.value = { code: report.codeReportIn, name: report.nameReportIn, typePeriodId: report.typePeriod.id,
        typeEnterpriseId: report.typeEnterprise.id, begin: report.indexRowScanBegin, end: report.indexRowScanEnd };
    references.value = template.references.map(ref => ({ key: ++keySequence, id: ref.id, referenceId: ref.reference.id,
        positionId: ref.typePosition.id, indexNum: ref.indexNum, orderSort: ref.orderSort }));
    fields.value = template.fields.map(field => {
        const parent = references.value.find(ref => ref.referenceId === field.referenceItem.reference.id);
        if (!parent) throw new Error('В отчёте найдено поле без добавленного справочника. Проверьте метаданные в БД.');
        return { key: ++keySequence, parentKey: parent.key, id: field.id, itemId: field.referenceItem.id,
            typeId: field.typeFieldValue.id, column: field.indexColumn, orderSort: field.orderSort, required: field.isRequired === 1 };
    });
    revision.value = template.revision;
    currentId.value = report.id;
    selected.value = references.value[0] ? { kind: 'reference', key: references.value[0].key } : null;
}

function selectedTypeId(value: unknown, types: { id: number }[], label: string): number {
    const id = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(id) || !types.some(type => type.id === id)) {
        throw new Error(`Не удалось определить ${label}. Вернитесь в список входящих отчётов, выберите тип периода и тип предприятия и нажмите «Создать отчёт».`);
    }
    return id;
}

async function load() {
    const version = ++loadVersion;
    loading.value = true;
    ready.value = false;
    error.value = '';
    success.value = '';
    showValidation.value = false;
    try {
        const [catalogs, refs, periods, enterprises] = await Promise.all([
            reportTemplateService.lookups(), allPages(drReferenceService.findPage),
            allPages(drTypePeriodService.findPage), allPages(drTypeEnterpriseService.findPage),
        ]);
        if (version !== loadVersion) return;
        lookups.value = catalogs;
        dictionaries.value = refs;
        periodTypes.value = periods;
        enterpriseTypes.value = enterprises;
        const id = route.params.id ? Number(route.params.id) : null;
        if (id !== null) {
            if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Некорректный номер отчёта.');
            const template = await reportTemplateService.get(id);
            if (version !== loadVersion) return;
            applyTemplate(template);
            await Promise.all(references.value.map(ref => ensureItems(ref.referenceId!)));
        } else {
            currentId.value = null;
            revision.value = null;
            references.value = [];
            fields.value = [];
            selected.value = null;
            header.value = { code: '', name: '',
                typePeriodId: selectedTypeId(route.query.typePeriodId, periods, 'тип периода'),
                typeEnterpriseId: selectedTypeId(route.query.typeEnterpriseId, enterprises, 'тип предприятия'),
                begin: 2, end: 1000000 };
            const access = await reportTemplateService.metadataAccess(header.value.typePeriodId!, header.value.typeEnterpriseId!);
            if (version !== loadVersion) return;
            readOnly.value = access.readOnly;
            readOnlyReason.value = access.reason;
        }
        if (version !== loadVersion) return;
        cleanSignature.value = signature.value;
        ready.value = true;
    } catch (cause) { if (version === loadVersion) error.value = message(cause); }
    finally { if (version === loadVersion) loading.value = false; }
}

function select(kind: 'reference' | 'field', key: number) { selected.value = { kind, key }; }
function freeColumn() {
    const used = new Set([...fields.value.map(field => field.column), ...references.value.filter(ref => !horizontal(ref)).map(ref => ref.indexNum)]);
    let column = 1;
    while (used.has(column) && column < 16384) column++;
    return column;
}
function addReference(layout: 'vertical' | 'horizontal') {
    if (disabled.value) return;
    const position = lookups.value.positions.find(item => {
        const name = item.nameTypePosition.trim().toLowerCase();
        return name === layout || name.startsWith(layout === 'vertical' ? 'вертик' : 'горизонт');
    });
    if (!position) {
        error.value = layout === 'vertical'
            ? 'В справочнике расположений отсутствует вертикальное расположение.'
            : 'В справочнике расположений отсутствует горизонтальное расположение.';
        return;
    }
    const ref: EditorReference = { key: ++keySequence, id: null, referenceId: null,
        positionId: position.id, indexNum: layout === 'horizontal' ? 1 : freeColumn(), orderSort: references.value.length + 1 };
    references.value.push(ref);
    select('reference', ref.key);
}
function addField(ref: EditorReference) {
    if (disabled.value) return;
    const numberType = lookups.value.fieldTypes.find(type => type.codeTypeField === 'NUMBER');
    const field: EditorField = { key: ++keySequence, parentKey: ref.key, id: null, itemId: null,
        typeId: numberType?.id ?? null, column: freeColumn(), orderSort: childFields(ref).length + 1, required: true };
    fields.value.push(field);
    select('field', field.key);
}
function removeSelected() {
    if (disabled.value) return;
    if (!selected.value) return;
    if (!window.confirm('Удалить выбранный элемент из структуры? Изменение вступит в силу после сохранения.')) return;
    if (selected.value.kind === 'reference') {
        fields.value = fields.value.filter(field => field.parentKey !== selected.value!.key);
        references.value = references.value.filter(ref => ref.key !== selected.value!.key);
        selected.value = null;
    } else {
        const parent = selectedParent.value;
        fields.value = fields.value.filter(field => field.key !== selected.value!.key);
        selected.value = parent ? { kind: 'reference', key: parent.key } : null;
    }
    success.value = '';
}
function reorder(direction: -1 | 1) {
    if (disabled.value) return;
    const node = selectedField.value ?? selectedReference.value;
    if (!node) return;
    const siblings = selectedField.value ? childFields(selectedParent.value!) :
        selectedReference.value && horizontal(selectedReference.value) ? horizontalReferences.value : verticalReferences.value;
    const index = siblings.findIndex(item => item.key === node.key);
    const neighbor = siblings[index + direction];
    if (!neighbor) return;
    siblings.forEach((item, itemIndex) => { item.orderSort = itemIndex + 1; });
    const previous = node.orderSort;
    node.orderSort = neighbor.orderSort;
    neighbor.orderSort = previous;
}

function columnOrderErrors(): string[] {
    const entries = [
        ...verticalReferences.value.map(ref => ({
            name: `Вертикальный справочник «${refName(ref)}»`, column: ref.indexNum,
        })),
        ...horizontalReferences.value.flatMap(ref => childFields(ref).map(field => ({
            name: `Поле «${fieldName(field)}» справочника «${refName(ref)}»`, column: field.column,
        }))),
    ];
    const errors: string[] = [];
    let previous: { name: string; column: number } | undefined;
    for (const entry of entries) {
        const column = entry.column;
        if (typeof column !== 'number' || !Number.isInteger(column) || column < 1 || column > 16384) {
            errors.push(`${entry.name}: номер столбца Excel должен быть целым числом от 1 до 16384.`);
            continue;
        }
        if (previous && column <= previous.column) {
            errors.push(`${entry.name}: номер столбца Excel (${column}) должен быть больше, чем у предыдущего элемента ${previous.name} (${previous.column}).`);
        }
        previous = { name: entry.name, column };
    }
    return errors;
}

const localErrors = computed(() => {
    const errors: string[] = [];
    if (!header.value.code.trim()) errors.push('Введите код отчёта.');
    if (!header.value.name.trim()) errors.push('Введите наименование отчёта.');
    if (!header.value.typePeriodId || !header.value.typeEnterpriseId) errors.push('Выберите тип периода и тип предприятия.');
    if (!header.value.begin || !header.value.end || header.value.end < header.value.begin || header.value.end > 1048576)
        errors.push('Задайте диапазон строк Excel от 1 до 1048576; конец не меньше начала.');
    if (!references.value.length) errors.push('Добавьте справочники отчёта.');
    if (!fields.value.length) errors.push('Добавьте поля горизонтальной шапки.');
    const refIds = new Set<number>();
    const columns = new Set<number>();
    for (const ref of references.value) {
        if (!ref.referenceId || !ref.positionId || !ref.indexNum) errors.push('Заполните справочник, расположение и координату каждого элемента.');
        if (ref.referenceId && refIds.has(ref.referenceId)) errors.push('Справочник добавлен дважды.');
        if (ref.referenceId) refIds.add(ref.referenceId);
        const max = horizontal(ref) ? 1048576 : 16384;
        if (ref.indexNum && (ref.indexNum < 1 || ref.indexNum > max)) errors.push(`Координата справочника должна быть от 1 до ${max}.`);
        if (horizontal(ref) && !childFields(ref).length) errors.push(`Добавьте поля в шапку «${refName(ref)}».`);
        if (!horizontal(ref) && childFields(ref).length) errors.push('Поля значений должны принадлежать горизонтальной шапке.');
        if (!horizontal(ref) && ref.indexNum) {
            if (columns.has(ref.indexNum)) errors.push('Несколько элементов занимают один столбец Excel.');
            columns.add(ref.indexNum);
        }
    }
    const itemIds = new Set<number>();
    for (const field of fields.value) {
        if (!field.itemId || !field.typeId || !field.column) errors.push('Выберите значение справочника, тип данных и столбец каждого поля.');
        if (field.column && (field.column < 1 || field.column > 16384)) errors.push('Столбец поля должен быть от 1 до 16384.');
        if (field.column && columns.has(field.column)) errors.push('Несколько элементов занимают один столбец Excel.');
        if (field.column) columns.add(field.column);
        if (field.itemId && itemIds.has(field.itemId)) errors.push('Значение справочника добавлено дважды.');
        if (field.itemId) itemIds.add(field.itemId);
    }
    errors.push(...columnOrderErrors());
    return [...new Set(errors)];
});
function payload(): ReportTemplateRequest {
    return {
        report: { codeReportIn: header.value.code.trim(), nameReportIn: header.value.name.trim(),
            typePeriod: { id: header.value.typePeriodId }, typeEnterprise: { id: header.value.typeEnterpriseId },
            indexRowScanBegin: header.value.begin, indexRowScanEnd: header.value.end },
        references: references.value.map(ref => ({ id: ref.id, referenceId: ref.referenceId, typePositionId: ref.positionId,
            indexNum: ref.indexNum, orderSort: ref.orderSort })),
        fields: fields.value.map(field => ({ id: field.id, referenceItemId: field.itemId, typeFieldValueId: field.typeId,
            indexColumn: field.column, orderSort: field.orderSort, isRequired: field.required ? 1 : 0 })),
        revision: revision.value,
    };
}
async function check() {
    showValidation.value = true;
    error.value = '';
    success.value = '';
    if (localErrors.value.length) return;
    checking.value = true;
    try { await reportTemplateService.validate(payload()); success.value = 'Структура проверена. Ошибок нет.'; }
    catch (cause) { error.value = message(cause); }
    finally { checking.value = false; }
}
async function save() {
    showValidation.value = true;
    error.value = '';
    success.value = '';
    if (disabled.value || localErrors.value.length) return;
    saving.value = true;
    try {
        const result = currentId.value === null ? await reportTemplateService.create(payload())
            : await reportTemplateService.update(currentId.value, payload());
        applyTemplate(result);
        cleanSignature.value = signature.value;
        showValidation.value = false;
        success.value = 'Отчёт и его структура сохранены.';
        if (!route.params.id) await router.replace(`/incoming-reports/${result.report.id}`);
    } catch (cause) { error.value = message(cause); }
    finally { saving.value = false; }
}
function reload() { if (!dirty.value || window.confirm('Отменить несохранённые изменения и перечитать отчёт?')) void load(); }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) { event.preventDefault(); event.returnValue = ''; } }
onBeforeRouteLeave(() => !saving.value && !checking.value &&
    (!dirty.value || window.confirm('В отчёте есть несохранённые изменения. Покинуть конструктор?')));
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); void load(); });
onBeforeUnmount(() => { ++loadVersion; window.removeEventListener('beforeunload', beforeUnload); });
</script>

<template>
    <div class="designer">
        <div class="designer-toolbar">
            <div><RouterLink to="/incoming-reports" class="back-link">← Входящие отчёты</RouterLink>
                <h1>{{ readOnly ? 'Просмотр метаданных входящего отчёта' : 'Конструктор входящего отчёта' }}</h1><span class="save-state">{{ readOnly ? 'Только просмотр' : dirty ? 'Есть несохранённые изменения' : currentId ? 'Структура сохранена' : 'Новый отчёт' }}</span></div>
            <div class="actions">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary" :disabled="saving || checking" :loading="loading" @click="reload" />
                <Button label="Проверить структуру" icon="pi pi-check-circle" severity="secondary" :loading="checking" :disabled="disabled || itemLoading > 0" @click="check" />
                <Button label="Сохранить" icon="pi pi-save" :loading="saving" :disabled="disabled || itemLoading > 0" @click="save" />
            </div>
        </div>
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <Message v-if="success" severity="success" :closable="false">{{ success }}</Message>
        <Message v-if="ready && readOnly" severity="info" :closable="false">{{ readOnlyReason }}</Message>
        <Message v-if="showValidation && localErrors.length" severity="error" :closable="false"><ul><li v-for="item in localErrors" :key="item">{{ item }}</li></ul></Message>
        <Message v-if="loading" severity="info" :closable="false">Загрузка структуры и справочников…</Message>
        <template v-if="ready">
            <section class="panel parameters"><h2>Основные параметры</h2>
                <div class="parameter-grid">
                    <div class="control"><label for="report-code">Код *</label><InputText id="report-code" v-model="header.code" :maxlength="50" :disabled="disabled" /></div>
                    <div class="control name-control"><label for="report-name">Наименование *</label><InputText id="report-name" v-model="header.name" :maxlength="300" :disabled="disabled" /></div>
                    <div class="control"><label for="report-period">Тип периода *</label><Select input-id="report-period" v-model="header.typePeriodId" :options="periodTypes" option-label="nameTypePeriod" option-value="id" placeholder="Выберите тип" disabled /></div>
                    <div class="control"><label for="report-enterprise">Тип предприятия *</label><Select input-id="report-enterprise" v-model="header.typeEnterpriseId" :options="enterpriseTypes" option-label="nameTypeEnterprise" option-value="id" placeholder="Выберите тип" disabled /></div>
                </div>
                <div class="scan-range"><span>Просмотр строк Excel:</span>
                    <label for="report-begin">с</label><InputNumber input-id="report-begin" v-model="header.begin" :min="1" :max="1048576" :use-grouping="false" :disabled="disabled" />
                    <label for="report-end">по</label><InputNumber input-id="report-end" v-model="header.end" :min="1" :max="1048576" :use-grouping="false" :disabled="disabled" />
                    <small>Нумерация строк и столбцов начинается с 1.</small>
                </div>
            </section>
            <div class="designer-columns">
                <section class="panel structure"><h2>Структура отчёта</h2>
                    <p class="muted">{{ readOnly ? 'Выберите элемент, чтобы посмотреть его свойства.' : 'Выберите элемент, чтобы настроить его справа.' }}</p>
                    <section class="structure-section" aria-labelledby="report-references-title">
                        <h3 id="report-references-title">Вертикальные сгруппированные справочники</h3>
                        <Button label="Добавить справочник" icon="pi pi-plus" outlined :disabled="disabled" @click="addReference('vertical')" />
                        <p v-if="!verticalReferences.length" class="muted">Вертикальные справочники пока не добавлены.</p>
                        <div class="structure-list">
                            <button v-for="ref in verticalReferences" :key="ref.key" type="button" class="structure-node"
                                :class="{ active: activeReference?.key === ref.key }" :aria-pressed="activeReference?.key === ref.key"
                                :disabled="busy" @click="select('reference', ref.key)">
                                <span><i class="pi pi-arrows-v"></i> {{ refName(ref) }}</span>
                                <small>{{ columnName(ref.indexNum) }} · {{ ref.indexNum ?? '—' }}</small>
                            </button>
                        </div>
                    </section>
                    <section class="structure-section" aria-labelledby="report-fields-title">
                        <h3 id="report-fields-title">Горизонтальные значение справочников</h3>
                        <Button label="Добавить справочник" icon="pi pi-plus" outlined :disabled="disabled" @click="addReference('horizontal')" />
                        <p v-if="!horizontalReferences.length" class="muted">Горизонтальные справочники пока не добавлены.</p>
                        <div v-for="ref in horizontalReferences" :key="ref.key" class="structure-list">
                            <button type="button" class="structure-node"
                                :class="{ active: activeReference?.key === ref.key }" :aria-pressed="activeReference?.key === ref.key"
                                :disabled="busy" @click="select('reference', ref.key)">
                                <span><i class="pi pi-arrows-h"></i> {{ refName(ref) }}</span>
                                <small>Строка {{ ref.indexNum ?? '—' }}</small>
                            </button>
                            <Button label="Добавить поле" icon="pi pi-plus" outlined
                                :disabled="disabled || !ref.referenceId || itemLoading > 0" @click="addField(ref)" />
                            <p v-if="!childFields(ref).length" class="muted">В этом справочнике пока нет полей.</p>
                            <button v-for="field in childFields(ref)" :key="field.key" type="button" class="structure-node"
                                :class="{ active: selected?.kind === 'field' && selected.key === field.key }"
                                :aria-pressed="selected?.kind === 'field' && selected.key === field.key"
                                :disabled="busy" @click="select('field', field.key)">
                                <span>{{ fieldName(field) }}<b v-if="field.required" title="Обязательное поле"> *</b></span>
                                <small>{{ columnName(field.column) }} · {{ field.column ?? '—' }}</small>
                            </button>
                        </div>
                    </section>
                </section>
                <section class="panel properties"><h2>{{ selectedField ? 'Настройки поля' : selectedReference ? 'Настройки справочника' : 'Настройки элемента' }}</h2>
                    <p v-if="!selected" class="muted">Выберите справочник или поле в структуре либо в предпросмотре.</p>
                    <template v-if="selectedReference">
                        <div class="control"><label for="node-reference">Справочник *</label><Select input-id="node-reference" v-model="selectedReference.referenceId" :options="availableReferences(selectedReference)" option-label="nameReference" option-value="id" filter placeholder="Выберите справочник"
                            :disabled="disabled || selectedReference.id !== null || childFields(selectedReference).length > 0" /></div>
                        <small class="muted">Для замены справочника с полями удалите элемент и добавьте новый.</small>
                        <div class="control"><label for="node-position">Расположение *</label><Select input-id="node-position" :model-value="selectedReference.positionId" :options="lookups.positions.filter(position => position.id === selectedReference?.positionId)" option-label="nameTypePosition" option-value="id" disabled /></div>
                        <div class="control"><label for="node-index">{{ horizontal(selectedReference) ? 'Номер строки Excel *' : 'Номер столбца Excel *' }}</label><InputNumber input-id="node-index" v-model="selectedReference.indexNum" :min="1" :max="horizontal(selectedReference) ? 1048576 : 16384" :use-grouping="false" :disabled="disabled" />
                            <small v-if="!horizontal(selectedReference)">Столбец {{ columnName(selectedReference.indexNum) }}</small></div>
                        <div class="control"><label for="node-order">Порядок отображения</label><InputNumber input-id="node-order" v-model="selectedReference.orderSort" :min="0" :max="9999999999" :use-grouping="false" :disabled="disabled" /></div>
                    </template>
                    <template v-if="selectedField && selectedParent">
                        <p class="parent-label">{{ refName(selectedParent) }}</p>
                        <div class="control"><label for="field-item">Значение справочника *</label><Select input-id="field-item" v-model="selectedField.itemId" :options="availableItems(selectedField)" option-label="nameReferenceItem" option-value="id" filter placeholder="Выберите значение"
                            :loading="itemLoading > 0" :disabled="disabled || itemLoading > 0 || selectedField.id !== null" /></div>
                        <Message v-if="itemErrors[selectedParent.referenceId ?? 0]" severity="error" :closable="false">{{ itemErrors[selectedParent.referenceId ?? 0] }}<Button label="Повторить" text @click="loadReferenceItems" /></Message>
                        <div class="control"><label for="field-type">Тип данных *</label><Select input-id="field-type" v-model="selectedField.typeId" :options="lookups.fieldTypes" option-label="nameTypeField" option-value="id" :disabled="disabled" /></div>
                        <div class="control"><label for="field-column">Номер столбца Excel *</label><InputNumber input-id="field-column" v-model="selectedField.column" :min="1" :max="16384" :use-grouping="false" :disabled="disabled" /><small>Столбец {{ columnName(selectedField.column) }}</small></div>
                        <div class="control"><label for="field-order">Порядок отображения</label><InputNumber input-id="field-order" v-model="selectedField.orderSort" :min="0" :max="9999999999" :use-grouping="false" :disabled="disabled" /></div>
                        <div class="checkbox-control"><Checkbox input-id="field-required" v-model="selectedField.required" binary :disabled="disabled" /><label for="field-required">Обязательное поле</label></div>
                        <small class="muted">Признак будет использоваться при импорте для проверки обязательных данных.</small>
                    </template>
                    <template v-if="selected"><div class="order-actions"><Button label="Выше" icon="pi pi-arrow-up" severity="secondary" :disabled="disabled" @click="reorder(-1)" /><Button label="Ниже" icon="pi pi-arrow-down" severity="secondary" :disabled="disabled" @click="reorder(1)" /></div>
                        <small v-if="selectedReference && !horizontal(selectedReference)" class="muted">Выше — влево, ниже — вправо. Меняется только порядок отображения.</small>
                        <small v-else class="muted">Меняется только порядок отображения.</small>
                        <Button label="Удалить элемент" icon="pi pi-trash" severity="danger" text :disabled="disabled" @click="removeSelected" />
                    </template>
                </section>
                <div class="panel preview"><ReportTemplatePreview :name="header.name" :begin="header.begin" :end="header.end"
                    :references="references" :fields="fields" :dictionaries="dictionaries" :items="dictionaryItems"
                    :positions="lookups.positions" :field-types="lookups.fieldTypes" :selected-key="selected?.key ?? null" @select="select" /></div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.designer { display: flex; flex-direction: column; gap: 18px; }
.designer-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h1 { font-size: 24px; margin: 10px 0 5px; color: var(--app-brand); }
h2 { margin: 0 0 18px; font-size: 17px; }
.back-link { color: var(--app-brand); text-decoration: none; }
.save-state, .muted { color: var(--p-text-muted-color); font-size: 12px; line-height: 1.5; }
.actions, .order-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.panel { background: var(--p-content-background); border: 1px solid var(--app-border); border-radius: 7px; padding: 20px; }
.parameter-grid { display: grid; grid-template-columns: minmax(100px, .7fr) minmax(180px, 2fr) repeat(2, minmax(140px, 1fr)); gap: 16px; }
.control { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.control label { font-size: 13px; }
.scan-range { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
.scan-range :deep(.p-inputnumber) { width: 115px; }
.scan-range :deep(input) { width: 100%; }
.scan-range small { color: var(--p-text-muted-color); }
.designer-columns { display: grid; grid-template-columns: minmax(210px, .85fr) minmax(245px, 1fr) minmax(350px, 2fr); gap: 16px; align-items: start; }
.structure, .properties { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.structure h2, .properties h2 { margin-bottom: 0; }
.structure .muted { margin: 0; }
.structure-section { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 12px; border: 1px solid var(--app-border); border-radius: 6px; background: var(--app-panel); }
.structure-section h3 { margin: 0; font-size: 14px; }
.structure-list { display: flex; flex-direction: column; gap: 7px; }
.structure-node { width: 100%; background: var(--p-content-background); border: 1px solid var(--app-border); color: var(--app-text); border-radius: 5px; padding: 11px; display: flex; align-items: center; justify-content: space-between; gap: 9px; text-align: left; cursor: pointer; }
.structure-node.active { background: var(--p-blue-50); border-color: var(--p-blue-500); color: var(--p-blue-700); }
.structure-node small { white-space: nowrap; background: var(--app-panel); padding: 4px 6px; border-radius: 12px; font-size: 11px; }
.structure-node i { margin-right: 5px; font-size: 12px; }
.structure-node:focus-visible { outline: 2px solid var(--p-blue-600); }
.preview { min-width: 0; }
.parent-label { font-weight: 600; color: var(--app-brand); margin: 0; }
.checkbox-control { display: flex; align-items: center; gap: 10px; }
.properties :deep(.p-inputnumber), .properties :deep(input) { width: 100%; }
ul { margin: 0; padding-left: 18px; }
@media (max-width: 1200px) { .designer-columns { grid-template-columns: 230px minmax(0, 1fr); } .preview { grid-column: 1 / -1; } }
@media (max-width: 760px) { .designer-columns, .parameter-grid { grid-template-columns: minmax(0, 1fr); } .preview { grid-column: auto; } .panel { padding: 16px; } h1 { font-size: 21px; } }
</style>
