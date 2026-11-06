<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import type { IncomingReportImportResult } from '@/core/models/incoming-report-import.model';
import { incomingReportImportService } from '@/core/services/incoming-report-import.service';

const visible = defineModel<boolean>('visible', { default: false });
const emit = defineEmits<{ imported: [result: IncomingReportImportResult] }>();
const input = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const uploading = ref(false);
const error = ref('');
const result = ref<IncomingReportImportResult | null>(null);
const details = ref<{ periodType: string; period: string; enterpriseType: string; enterprise: string } | null>(null);
const fileSize = computed(() => file.value
    ? `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(file.value.size / 1024)} КБ` : '');

watch(visible, open => {
    if (!open || uploading.value) return;
    file.value = null;
    details.value = null;
    error.value = '';
    result.value = null;
});
onBeforeRouteLeave(() => !uploading.value);

function chooseFile() {
    if (!input.value || uploading.value) return;
    input.value.value = '';
    input.value.click();
}

function selectFile(event: Event) {
    if (uploading.value) return;
    const chosen = (event.target as HTMLInputElement).files?.[0];
    if (!chosen) return;
    file.value = null;
    details.value = null;
    error.value = '';
    result.value = null;
    if (!/\.xlsx$/i.test(chosen.name)) {
        error.value = 'Выберите книгу Excel в формате .xlsx.';
        return;
    }
    if (!chosen.size || chosen.size > 20 * 1024 * 1024) {
        error.value = 'Выберите непустую книгу Excel размером до 20 МБ.';
        return;
    }
    const match = /^([A-Za-z0-9-]{3})_([A-Za-z0-9-]{1,20})_([A-Za-z0-9-]{1,50})_([A-Za-z0-9-]{1,20})\.xlsx$/i.exec(chosen.name);
    if (!match) {
        error.value = 'Имя файла должно содержать четыре кода через знак подчёркивания, например QUA_2026Q02_BANK_1000001.xlsx. В кодах допускаются латинские буквы, цифры и дефис.';
        return;
    }
    file.value = chosen;
    details.value = { periodType: match[1]!, period: match[2]!, enterpriseType: match[3]!, enterprise: match[4]! };
}

async function upload() {
    if (!file.value || uploading.value || result.value) return;
    uploading.value = true;
    error.value = '';
    try {
        result.value = await incomingReportImportService.upload(file.value);
        emit('imported', result.value);
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Не удалось импортировать файл.';
    } finally { uploading.value = false; }
}
</script>

<template>
    <Dialog v-model:visible="visible" header="Загрузить Excel" modal :closable="!uploading" :close-on-escape="!uploading"
            :style="{ width: '40rem' }" :breakpoints="{ '680px': '95vw' }">
        <div class="upload-content" :aria-busy="uploading">
            <p class="intro">Загрузите входящие отчёты одного предприятия за один период. Максимальный размер файла — 20 МБ.</p>
            <div class="file-format">
                <strong>Имя файла</strong>
                <p>Код типа периода_Код периода_Код типа предприятия_Код предприятия.xlsx</p>
                <code>QUA_2026Q02_BANK_1000001.xlsx</code>
                <p>Имя каждого листа — код формы отчёта: например, R01, R02, R03, R04.</p>
            </div>
            <input ref="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden @change="selectFile" />
            <Button :label="file ? 'Выбрать другой файл' : 'Выбрать файл Excel'" icon="pi pi-folder-open" outlined :disabled="uploading" @click="chooseFile" />
            <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
            <div v-if="file && details && !result" class="selected-file" aria-live="polite">
                <div class="file-heading"><i class="pi pi-file-excel" aria-hidden="true"></i><div><strong>{{ file.name }}</strong><small>{{ fileSize }}</small></div></div>
                <dl>
                    <div><dt>Код типа периода</dt><dd>{{ details.periodType }}</dd></div>
                    <div><dt>Код периода</dt><dd>{{ details.period }}</dd></div>
                    <div><dt>Код типа предприятия</dt><dd>{{ details.enterpriseType }}</dd></div>
                    <div><dt>Код предприятия</dt><dd>{{ details.enterprise }}</dd></div>
                </dl>
                <Message severity="info" :closable="false">Все листы загружаются вместе. Если обнаружится ошибка, данные файла не сохранятся. Уже сданные формы не перезаписываются.</Message>
            </div>
            <Message v-if="uploading" severity="info" :closable="false">Импортируем отчёты. Дождитесь результата загрузки.</Message>
            <div v-if="result" class="import-result" aria-live="polite">
                <Message severity="success" :closable="false">Импорт завершён: {{ result.totalRows }} строк, {{ result.totalValues }} значений.</Message>
                <p class="intro"><strong>{{ result.periodName }}</strong> · {{ result.enterpriseName }}</p>
                <table class="result-table"><caption>Загруженные формы</caption><thead><tr><th>Лист</th><th>Строки Excel</th><th>Строк</th><th>Значений</th></tr></thead>
                    <tbody><tr v-for="sheet in result.sheets" :key="sheet.reportId"><td>{{ sheet.sheetName }}</td><td>{{ sheet.firstDataRow }}–{{ sheet.lastDataRow }}</td><td>{{ sheet.rowsImported }}</td><td>{{ sheet.valuesImported }}</td></tr></tbody>
                </table>
            </div>
        </div>
        <template #footer>
            <Button label="Закрыть" severity="secondary" :disabled="uploading" @click="visible = false" />
            <Button v-if="!result" label="Импортировать" icon="pi pi-upload" :loading="uploading" :disabled="!file || uploading" @click="upload" />
        </template>
    </Dialog>
</template>

<style scoped>
.upload-content { display: flex; flex-direction: column; gap: 18px; }
.intro, .file-format p { margin: 0; line-height: 1.65; font-size: 13px; }
.intro, .file-format p, dt, small { color: var(--p-text-muted-color); }
.file-format, .selected-file { padding: 16px; border: 1px solid var(--app-border); border-radius: 7px; }
.file-format { display: flex; flex-direction: column; gap: 8px; background: var(--app-panel); }
.file-format strong { font-size: 13px; }
code { font-size: 13px; overflow-wrap: anywhere; }
.file-heading { display: flex; gap: 12px; align-items: center; }
.file-heading > .pi { font-size: 26px; color: var(--app-brand); }
.file-heading strong { display: block; font-size: 13px; overflow-wrap: anywhere; }
small { display: block; margin-top: 5px; font-size: 12px; }
dl { margin: 16px 0; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
dl > div { display: flex; justify-content: space-between; gap: 16px; }
dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; text-align: right; }

.import-result { display: flex; flex-direction: column; gap: 16px; }
.result-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
.result-table caption { text-align: left; margin-bottom: 10px; font-weight: 600; }
.result-table th, .result-table td { padding: 9px 6px; border-bottom: 1px solid var(--app-border); }
.result-table th { color: var(--p-text-muted-color); font-weight: 500; }
</style>
