<script setup lang="ts">
import { computed } from 'vue';
import type { EditorField, EditorReference, TypePosition, TypeField } from '@/core/models/report-template.model';
import type { DrReference } from '@/core/models/dr-reference.model';
import type { DrReferenceItem } from '@/core/models/dr-reference-item.model';

const props = defineProps<{
    name: string; begin: number | null; end: number | null;
    references: EditorReference[]; fields: EditorField[]; dictionaries: DrReference[];
    items: Record<number, DrReferenceItem[]>; positions: TypePosition[]; fieldTypes: TypeField[];
    selectedKey: number | null;
}>();
const emit = defineEmits<{ select: [kind: 'reference' | 'field', key: number] }>();
function horizontal(ref: EditorReference) {
    const name = props.positions.find(item => item.id === ref.positionId)?.nameTypePosition.toLowerCase() ?? '';
    return name.startsWith('горизонт') || name === 'horizontal';
}
function columnName(value: number): string {
    let name = '';
    while (value > 0) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26); }
    return name;
}
const vertical = computed(() => props.references.filter(ref => !horizontal(ref) && ref.indexNum)
    .sort((a, b) => a.indexNum! - b.indexNum!));
const horizontalRefs = computed(() => props.references.filter(horizontal));
const headerRows = computed(() => [...new Set(horizontalRefs.value.map(ref => ref.indexNum)
    .filter((row): row is number => !!row))].sort((a, b) => a - b));
const columns = computed(() => {
    const used = [...vertical.value.map(ref => ref.indexNum!), ...props.fields.map(field => field.column ?? 0)]
        .filter(column => column >= 1 && column <= 16384);
    const max = Math.max(5, ...used);
    if (max <= 16) return Array.from({ length: max }, (_, index) => index + 1);
    return [...new Set([...Array.from({ length: 5 }, (_, index) => index + 1), ...used])].sort((a, b) => a - b);
});
const firstDataRow = computed(() => Math.max(props.begin ?? 1, (headerRows.value.at(-1) ?? 1) + 1));
const dataRows = computed(() => Array.from({ length: Math.max(0, Math.min(6, (props.end ?? firstDataRow.value + 5) - firstDataRow.value + 1)) },
    (_, index) => firstDataRow.value + index));
function dimension(column: number) { return vertical.value.find(ref => ref.indexNum === column); }
function field(column: number) { return props.fields.find(item => item.column === column); }
function referenceName(ref: EditorReference) {
    return props.dictionaries.find(item => item.id === ref.referenceId)?.nameReference ?? 'Справочник';
}
function fieldName(item: EditorField) {
    const parent = props.references.find(ref => ref.key === item.parentKey);
    return props.items[parent?.referenceId ?? 0]?.find(value => value.id === item.itemId)?.nameReferenceItem ?? 'Новое поле';
}
function header(column: number, row: number) {
    const dim = dimension(column);
    if (dim && row === headerRows.value[0]) return referenceName(dim);
    const item = field(column);
    if (!item) return '';
    const parent = props.references.find(ref => ref.key === item.parentKey);
    return parent?.indexNum === row ? fieldName(item) : '';
}
function selectColumn(column: number) {
    const dim = dimension(column);
    const item = field(column);
    if (dim) emit('select', 'reference', dim.key);
    else if (item) emit('select', 'field', item.key);
}
function selected(column: number) {
    return dimension(column)?.key === props.selectedKey || field(column)?.key === props.selectedKey;
}
function groupSize(ref: EditorReference) {
    return 2 ** Math.min(3, Math.max(0, vertical.value.length - vertical.value.indexOf(ref) - 1));
}
function showDimension(ref: EditorReference, index: number) { return index % groupSize(ref) === 0; }
function span(ref: EditorReference, index: number) { return Math.min(groupSize(ref), dataRows.value.length - index); }
function dimensionValue(ref: EditorReference, index: number) {
    const examples = props.items[ref.referenceId ?? 0]?.slice(0, 2) ?? [];
    return examples[Math.floor(index / groupSize(ref)) % Math.max(1, examples.length)]?.nameReferenceItem ?? 'Значение';
}
function typeLabel(column: number) {
    const item = field(column);
    const code = props.fieldTypes.find(type => type.id === item?.typeId)?.codeTypeField;
    return code === 'NUMBER' ? '0,00' : code === 'DATETIME' ? 'дд.мм.гггг' : code === 'STRING' ? 'Текст' : '—';
}
</script>

<template>
    <section class="preview-panel">
        <div class="preview-title"><h2>Предпросмотр формы</h2><span>По метаданным отчёта</span></div>
        <p class="preview-note"><i class="pi pi-info-circle" aria-hidden="true"></i> Пример структуры. Значения в этом окне не сохраняются.</p>
        <div v-if="!references.length" class="preview-empty"><i class="pi pi-table"></i><p>Добавьте справочник, затем настройте расположение и поля.</p></div>
        <div v-else class="grid-scroll">
            <table class="excel-grid">
                <thead><tr><th class="row-number"></th><th v-for="column in columns" :key="column">{{ columnName(column) }} · {{ column }}</th></tr></thead>
                <tbody>
                    <tr v-if="!headerRows.includes(1)"><th class="row-number">1</th><td :colspan="columns.length" class="report-name">{{ name || 'Новый входящий отчёт' }}</td></tr>
                    <tr v-for="row in headerRows" :key="`header-${row}`"><th class="row-number">{{ row }}</th>
                        <td v-for="column in columns" :key="column" class="header-cell" :class="{ selected: selected(column) }">
                            <button type="button" class="cell-button" @click="selectColumn(column)">{{ header(column, row) || '—' }}</button>
                        </td>
                    </tr>
                    <tr v-for="(row, index) in dataRows" :key="row"><th class="row-number">{{ row }}</th>
                        <template v-for="column in columns" :key="column">
                            <td v-if="dimension(column) && showDimension(dimension(column)!, index)" :rowspan="span(dimension(column)!, index)"
                                class="dimension-cell" :class="{ selected: selected(column) }">
                                <button type="button" class="cell-button" @click="selectColumn(column)">{{ dimensionValue(dimension(column)!, index) }}</button>
                            </td>
                            <td v-else-if="!dimension(column)" class="value-cell" :class="{ selected: selected(column) }">
                                <button v-if="field(column)" type="button" class="cell-button" @click="selectColumn(column)">{{ typeLabel(column) }}</button>
                            </td>
                        </template>
                    </tr>
                </tbody>
            </table>
        </div>
        <p class="preview-footer">Координаты соответствуют Excel. Показаны до 6 строк примера; диапазон импорта задаётся отдельно.</p>
    </section>
</template>

<style scoped>
.preview-panel { min-width: 0; }
.preview-title { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; }
h2 { margin: 0; font-size: 17px; }
.preview-title span, .preview-footer { color: var(--p-text-muted-color); font-size: 12px; }
.preview-note { padding: 12px; border: 1px solid var(--p-blue-200); border-radius: 5px; background: var(--p-blue-50); color: var(--p-blue-700); line-height: 1.5; }
.grid-scroll { overflow: auto; max-height: 580px; }
.excel-grid { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 12px; }
.excel-grid th, .excel-grid td { border: 1px solid var(--app-border); height: 43px; padding: 0; min-width: 85px; }
.excel-grid th { background: var(--app-panel); color: var(--p-text-muted-color); font-weight: 500; }
.excel-grid .row-number { min-width: 36px; width: 36px; text-align: center; }
.excel-grid .report-name { padding: 12px; font-weight: 600; }
.header-cell { background: var(--app-panel); font-weight: 600; }
.value-cell { color: var(--p-text-muted-color); }
.excel-grid .selected { background: var(--p-blue-50); box-shadow: inset 0 0 0 1px var(--p-blue-400); }
.cell-button { width: 100%; min-height: 42px; padding: 10px 8px; background: transparent; color: inherit; border: 0; cursor: pointer; text-align: center; }
.cell-button:focus-visible { outline: 2px solid var(--p-blue-600); outline-offset: -2px; }
.preview-empty { min-height: 300px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: var(--p-text-muted-color); padding: 24px; }
.preview-empty > i { font-size: 36px; }
</style>
