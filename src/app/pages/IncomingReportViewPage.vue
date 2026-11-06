<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Paginator from 'primevue/paginator';
import IncomingReportTable from '@/app/components/IncomingReportTable.vue';
import type { DrTypePeriod } from '@/core/models/dr-type-period.model';
import type { DrTypeEnterprise } from '@/core/models/dr-type-enterprise.model';
import type { IncomingReportView } from '@/core/models/incoming-report-view.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/core/models/page.model';
import { drTypePeriodService } from '@/core/services/dr-type-period.service';
import { drTypeEnterpriseService } from '@/core/services/dr-type-enterprise.service';
import { allPages } from '@/core/services/report-template.service';
import { incomingReportViewService, type IncomingReportSubmission, type SubmittedIncomingReport } from '@/core/services/incoming-report-view.service';

const periodTypes = ref<DrTypePeriod[]>([]);
const enterpriseTypes = ref<DrTypeEnterprise[]>([]);
const selectedPeriodTypes = ref<number[]>([]);
const selectedEnterpriseTypes = ref<number[]>([]);
const initialized = ref(false);
const catalogsLoading = ref(false);
const catalogsError = ref('');
const search = ref('');
const submissions = ref<IncomingReportSubmission[]>([]);
const submissionsLoading = ref(false);
const submissionsError = ref('');
const submissionsTotal = ref(0);
const submissionsFirst = ref(0);
const submissionsSize = ref(20);
const activeSubmission = ref<IncomingReportSubmission | null>(null);
const reports = ref<SubmittedIncomingReport[]>([]);
const reportsLoading = ref(false);
const reportsError = ref('');
const activeReport = ref<SubmittedIncomingReport | null>(null);
const view = ref<IncomingReportView | null>(null);
const loading = ref(false);
const error = ref('');
const first = ref(0);
const rows = ref(DEFAULT_PAGE_SIZE);
let catalogVersion = 0;
let submissionVersion = 0;
let reportVersion = 0;
let viewVersion = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

function message(cause: unknown) { return cause instanceof Error ? cause.message : 'Не удалось выполнить запрос.'; }
function clearView() {
    ++viewVersion;
    activeReport.value = null;
    view.value = null;
    loading.value = false;
    error.value = '';
    first.value = 0;
}
function clearSelection() {
    ++reportVersion;
    activeSubmission.value = null;
    reports.value = [];
    reportsLoading.value = false;
    reportsError.value = '';
    clearView();
}
async function loadSubmissions(page = 0, resetSelection = true) {
    clearTimeout(searchTimer);
    const version = ++submissionVersion;
    if (resetSelection) clearSelection();
    submissions.value = [];
    submissionsTotal.value = 0;
    submissionsFirst.value = page * submissionsSize.value;
    submissionsError.value = '';
    submissionsLoading.value = false;
    if (catalogsLoading.value || catalogsError.value || !selectedPeriodTypes.value.length || !selectedEnterpriseTypes.value.length) return;
    submissionsLoading.value = true;
    try {
        let result = await incomingReportViewService.submissions([...selectedPeriodTypes.value], [...selectedEnterpriseTypes.value], search.value, page, submissionsSize.value);
        if (version !== submissionVersion) return;
        if (page > 0 && page >= result.totalPages) {
            result = await incomingReportViewService.submissions([...selectedPeriodTypes.value], [...selectedEnterpriseTypes.value], search.value,
                Math.max(0, result.totalPages - 1), submissionsSize.value);
            if (version !== submissionVersion) return;
        }
        submissions.value = result.content;
        submissionsTotal.value = result.totalElements;
        submissionsFirst.value = result.page * result.size;
    } catch (cause) {
        if (version === submissionVersion) submissionsError.value = message(cause);
    } finally { if (version === submissionVersion) submissionsLoading.value = false; }
}
function searchChanged() {
    clearTimeout(searchTimer);
    ++submissionVersion;
    clearSelection();
    submissions.value = [];
    submissionsTotal.value = 0;
    submissionsError.value = '';
    submissionsLoading.value = true;
    searchTimer = setTimeout(() => { void loadSubmissions(); }, 300);
}
function changeSubmissionPage(event: { first: number; rows: number }) {
    submissionsSize.value = event.rows;
    void loadSubmissions(Math.floor(event.first / event.rows), false);
}
function selected(submission: IncomingReportSubmission) {
    return activeSubmission.value?.periodId === submission.periodId && activeSubmission.value?.enterpriseId === submission.enterpriseId;
}
async function openSubmission(submission: IncomingReportSubmission) {
    const version = ++reportVersion;
    clearView();
    activeSubmission.value = submission;
    reports.value = [];
    reportsError.value = '';
    reportsLoading.value = true;
    try {
        const result = await allPages((page, size) => incomingReportViewService.submittedReports(submission.periodId, submission.enterpriseId, page, size));
        if (version === reportVersion) reports.value = result;
    } catch (cause) {
        if (version === reportVersion) reportsError.value = message(cause);
    } finally { if (version === reportVersion) reportsLoading.value = false; }
}
async function load(page = 0) {
    const submission = activeSubmission.value;
    const report = activeReport.value;
    if (!submission || !report) return;
    const version = ++viewVersion;
    loading.value = true;
    error.value = '';
    view.value = null;
    try {
        let result = await incomingReportViewService.get(report.id, submission.periodId, submission.enterpriseId, page, rows.value);
        if (version !== viewVersion) return;
        if (page > 0 && page >= result.rows.totalPages) {
            result = await incomingReportViewService.get(report.id, submission.periodId, submission.enterpriseId,
                Math.max(0, result.rows.totalPages - 1), rows.value);
            if (version !== viewVersion) return;
        }
        view.value = result;
        first.value = result.rows.page * result.rows.size;
    } catch (cause) {
        if (version === viewVersion) error.value = message(cause);
    } finally { if (version === viewVersion) loading.value = false; }
}
function openReport(report: SubmittedIncomingReport) {
    clearView();
    activeReport.value = report;
    void load();
}
function changePage(event: { first: number; rows: number }) {
    rows.value = event.rows;
    void load(Math.floor(event.first / event.rows));
}
async function refresh() {
    clearTimeout(searchTimer);
    const version = ++catalogVersion;
    ++submissionVersion;
    clearSelection();
    submissions.value = [];
    submissionsTotal.value = 0;
    submissionsError.value = '';
    submissionsLoading.value = false;
    catalogsLoading.value = true;
    catalogsError.value = '';
    try {
        const [periodList, enterpriseList] = await Promise.all([
            allPages(drTypePeriodService.findPage), allPages(drTypeEnterpriseService.findPage),
        ]);
        if (version !== catalogVersion) return;
        periodTypes.value = periodList;
        enterpriseTypes.value = enterpriseList;
        if (!initialized.value) {
            selectedPeriodTypes.value = periodList[0] ? [periodList[0].id] : [];
            selectedEnterpriseTypes.value = enterpriseList[0] ? [enterpriseList[0].id] : [];
            initialized.value = true;
        } else {
            selectedPeriodTypes.value = selectedPeriodTypes.value.filter(id => periodList.some(type => type.id === id));
            selectedEnterpriseTypes.value = selectedEnterpriseTypes.value.filter(id => enterpriseList.some(type => type.id === id));
        }
        catalogsLoading.value = false;
        await loadSubmissions();
    } catch (cause) {
        if (version === catalogVersion) catalogsError.value = message(cause);
    } finally { if (version === catalogVersion) catalogsLoading.value = false; }
}
onMounted(refresh);
onBeforeUnmount(() => { clearTimeout(searchTimer); ++catalogVersion; ++submissionVersion; ++reportVersion; ++viewVersion; });
</script>

<template>
    <div class="report-browser">
        <header class="page-heading">
            <div><p class="eyebrow">ОТЧЁТЫ</p><h1>Входящие отчёты</h1>
                <p class="muted">Выберите период и предприятие, затем откройте сданный отчёт.</p></div>
            <Button label="Обновить" icon="pi pi-refresh" severity="secondary" outlined :loading="catalogsLoading" @click="refresh" />
        </header>
        <Message v-if="catalogsError" severity="error" :closable="false">{{ catalogsError }}</Message>
        <div class="browser-row top-row">
            <aside class="panel types-panel" aria-label="Типы периодов и предприятий">
                <fieldset :disabled="catalogsLoading" class="type-group">
                    <legend>Типы периодов</legend>
                    <label v-for="type in periodTypes" :key="type.id" class="check-row" :class="{ checked: selectedPeriodTypes.includes(type.id) }">
                        <input v-model="selectedPeriodTypes" type="checkbox" :value="type.id" @change="loadSubmissions()" /><span>{{ type.nameTypePeriod }}</span>
                    </label>
                    <p v-if="!periodTypes.length" class="empty-note">{{ catalogsLoading ? 'Загрузка…' : 'Типы периодов не добавлены.' }}</p>
                </fieldset>
                <fieldset :disabled="catalogsLoading" class="type-group enterprise-types">
                    <legend>Типы предприятий</legend>
                    <label v-for="type in enterpriseTypes" :key="type.id" class="check-row" :class="{ checked: selectedEnterpriseTypes.includes(type.id) }">
                        <input v-model="selectedEnterpriseTypes" type="checkbox" :value="type.id" @change="loadSubmissions()" /><span>{{ type.nameTypeEnterprise }}</span>
                    </label>
                    <p v-if="!enterpriseTypes.length" class="empty-note">{{ catalogsLoading ? 'Загрузка…' : 'Типы предприятий не добавлены.' }}</p>
                </fieldset>
            </aside>
            <section class="panel submissions-panel" aria-label="Периоды и предприятия со сданными отчётами" :aria-busy="submissionsLoading">
                <div class="section-heading">
                    <div><h2>Периоды и предприятия <span class="count">{{ submissionsTotal }}</span></h2><p class="muted">Только с загруженными отчётами. Нажмите строку для выбора.</p></div>
                    <div class="search-wrap"><i class="pi pi-search" aria-hidden="true"></i><input v-model="search" class="search" type="search" maxlength="300" placeholder="Период, предприятие или код…" aria-label="Поиск по периоду, предприятию или коду" :disabled="catalogsLoading" @input="searchChanged" /></div>
                </div>
                <Message v-if="submissionsError" severity="error" :closable="false">{{ submissionsError }} <Button label="Повторить" text @click="loadSubmissions()" /></Message>
                <div v-else-if="catalogsLoading || submissionsLoading" class="compact-empty" role="status"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Загрузка списка…</div>
                <div v-else-if="!selectedPeriodTypes.length || !selectedEnterpriseTypes.length" class="compact-empty">Отметьте хотя бы один тип периода и один тип предприятия слева.</div>
                <div v-else-if="!submissions.length" class="compact-empty"><i class="pi pi-inbox" aria-hidden="true"></i> Сданных отчётов для выбранных условий нет.</div>
                <div v-else class="submission-scroll">
                    <table class="selection-table"><thead><tr><th>Период</th><th>Предприятие</th></tr></thead>
                        <tbody><tr v-for="item in submissions" :key="`${item.periodId}-${item.enterpriseId}`" tabindex="0" :class="{ selected: selected(item) }" :aria-selected="selected(item)"
                            @click="openSubmission(item)" @keydown.enter.prevent="openSubmission(item)" @keydown.space.prevent="openSubmission(item)">
                            <td><span class="period-cell"><i v-if="selected(item)" class="pi pi-check-circle" aria-hidden="true"></i>{{ item.periodName }}</span></td>
                            <td><strong>{{ item.enterpriseName }}</strong><small>{{ item.enterpriseCode }}</small></td>
                        </tr></tbody>
                    </table>
                </div>
                <Paginator v-if="submissionsTotal" :first="submissionsFirst" :rows="submissionsSize" :total-records="submissionsTotal"
                    :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changeSubmissionPage"
                    template="PrevPageLink PageLinks NextPageLink RowsPerPageDropdown CurrentPageReport" current-page-report-template="{first}–{last} из {totalRecords}" />
            </section>
        </div>
        <div class="browser-row bottom-row">
            <aside class="panel reports-panel" aria-label="Сданные входящие отчёты" :aria-busy="reportsLoading">
                <div class="reports-heading"><h2>Входящие отчёты <span v-if="activeSubmission" class="count">{{ reports.length }}</span></h2>
                    <p v-if="activeSubmission" class="selection-context"><strong>{{ activeSubmission.enterpriseName }}</strong><span>{{ activeSubmission.periodName }}</span></p></div>
                <div v-if="!activeSubmission" class="sidebar-empty"><i class="pi pi-arrow-up" aria-hidden="true"></i><p>Выберите строку<br />«Период + Предприятие» выше.</p></div>
                <div v-else-if="reportsLoading" class="sidebar-empty" role="status"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i><p>Загрузка отчётов…</p></div>
                <Message v-else-if="reportsError" severity="error" :closable="false">{{ reportsError }}<Button label="Повторить" text @click="openSubmission(activeSubmission)" /></Message>
                <p v-else-if="!reports.length" class="empty-note">Загруженных отчётов больше нет. Обновите список периодов и предприятий.</p>
                <div v-else class="report-list">
                    <button v-for="report in reports" :key="report.id" type="button" class="report-item" :class="{ active: activeReport?.id === report.id }" :aria-pressed="activeReport?.id === report.id" @click="openReport(report)">
                        <i class="pi pi-table" aria-hidden="true"></i><span><strong>{{ report.nameReportIn }}</strong><small>{{ report.codeReportIn }}</small></span><i class="pi pi-angle-right" aria-hidden="true"></i>
                    </button>
                </div>
            </aside>
            <section class="panel data-panel" aria-label="Данные выбранного входящего отчёта" :aria-busy="loading">
                <div v-if="!activeReport" class="welcome">
                    <i class="pi pi-table" aria-hidden="true"></i><h2>Просмотр отчёта</h2>
                    <p>{{ activeSubmission ? 'Нажмите входящий отчёт в списке слева — его данные появятся здесь.' : 'Выберите период и предприятие в верхней таблице, затем входящий отчёт в списке слева.' }}</p>
                </div>
                <template v-else>
                    <div class="section-heading"><div><h2>{{ activeReport.nameReportIn }}</h2><p class="muted">{{ activeSubmission?.enterpriseName }} / {{ activeSubmission?.periodName }} / {{ activeReport.codeReportIn }}</p></div>
                        <Button label="Обновить данные" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading" @click="load(Math.floor(first / rows))" /></div>
                    <Message v-if="error" severity="error" :closable="false">{{ error }} <Button label="Повторить" text @click="load()" /></Message>
                    <div v-if="loading" class="welcome" role="status"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i><p>Загрузка отчёта…</p></div>
                    <template v-if="view">
                        <IncomingReportTable :report="view" />
                        <Paginator v-if="view.rows.totalElements" :first="first" :rows="rows" :total-records="view.rows.totalElements" :rows-per-page-options="PAGE_SIZE_OPTIONS" @page="changePage"
                            template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport" current-page-report-template="{first}–{last} из {totalRecords}" />
                    </template>
                </template>
            </section>
        </div>
    </div>
</template>

<style scoped>
.report-browser { display: flex; flex-direction: column; gap: 18px; }
.page-heading, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h1, h2, p { margin: 0; }
h1 { font-size: 26px; color: var(--app-brand); letter-spacing: -.5px; }
h2 { font-size: 16px; line-height: 1.5; }
.eyebrow { color: var(--app-brand); font-size: 11px; letter-spacing: 1.8px; font-weight: 700; margin-bottom: 5px; }
.muted, small { color: var(--p-text-muted-color); }
.page-heading .muted, .section-heading .muted { margin-top: 5px; line-height: 1.5; font-size: 13px; }
.browser-row { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 18px; align-items: stretch; }
.panel { background: var(--p-content-background); border: 1px solid var(--app-border); border-radius: 9px; min-width: 0; }
.types-panel { padding: 18px 14px; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
legend { font-size: 14px; font-weight: 700; margin-bottom: 9px; padding: 0 7px; color: var(--app-brand); }
.enterprise-types { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--app-border); }
.enterprise-types legend { float: left; width: 100%; } .enterprise-types legend + * { clear: both; }
.check-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px; border-radius: 5px; cursor: pointer; line-height: 1.5; }
.check-row.checked, .check-row:hover { background: var(--app-panel); }
input[type=checkbox] { width: 17px; height: 17px; margin: 2px 0 0; accent-color: var(--app-brand); flex: 0 0 auto; cursor: pointer; }
.submissions-panel { padding: 18px 20px 8px; display: flex; flex-direction: column; gap: 14px; }
.count { display: inline-flex; justify-content: center; align-items: center; min-width: 24px; padding: 2px 7px; margin-left: 5px; border-radius: 20px; font-size: 11px; font-weight: 600; color: var(--app-brand); background: var(--app-panel); vertical-align: middle; }
.search-wrap { position: relative; width: 310px; max-width: 100%; }
.search-wrap > .pi { position: absolute; top: 12px; left: 12px; font-size: 13px; color: var(--p-text-muted-color); }
.search { width: 100%; padding: 10px 10px 10px 34px; border: 1px solid var(--app-border); border-radius: 6px; background: var(--p-content-background); color: inherit; font-size: 13px; }
.submission-scroll { max-height: 255px; min-height: 170px; overflow: auto; scrollbar-width: thin; }
.selection-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
.selection-table th { position: sticky; top: 0; z-index: 1; background: var(--app-panel); color: var(--p-text-muted-color); font-size: 12px; font-weight: 600; padding: 10px 14px; border-bottom: 1px solid var(--app-border); }
.selection-table td { padding: 11px 14px; border-bottom: 1px solid var(--app-border); }
.selection-table tbody tr { cursor: pointer; }
.selection-table tbody tr:hover { background: var(--app-panel); }
.selection-table tbody tr.selected { background: var(--app-panel); color: var(--app-brand); }
.selection-table tbody tr.selected td:first-child { box-shadow: inset 3px 0 var(--app-brand); }
.period-cell { display: flex; align-items: center; gap: 9px; }
.period-cell .pi { color: var(--app-brand); }
small { display: block; font-size: 11px; font-weight: 400; margin-top: 3px; }
.compact-empty { flex: 1; min-height: 170px; display: flex; align-items: center; justify-content: center; gap: 12px; text-align: center; color: var(--p-text-muted-color); padding: 24px; font-size: 13px; }
.reports-panel { overflow: hidden; min-height: 420px; }
.reports-heading { padding: 18px 16px; border-bottom: 1px solid var(--app-border); }
.selection-context { margin-top: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.selection-context strong { display: block; font-size: 13px; font-weight: 600; }.selection-context span { display: block; color: var(--p-text-muted-color); font-size: 12px; margin-top: 3px; }
.report-list { padding: 8px; display: flex; flex-direction: column; gap: 4px; max-height: 65vh; overflow: auto; }
.report-item { display: flex; align-items: flex-start; gap: 10px; width: 100%; text-align: left; padding: 13px 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.report-item > .pi { margin-top: 3px; color: var(--app-brand); }.report-item > .pi:last-child { margin-left: auto; }
.report-item span { min-width: 0; overflow-wrap: anywhere; }.report-item strong { font-size: 13px; font-weight: 600; line-height: 1.5; }
.report-item:hover, .report-item.active { background: var(--app-panel); }.report-item.active { border-color: var(--app-brand); color: var(--app-brand); }
.data-panel { min-height: 420px; padding: 20px; display: flex; flex-direction: column; gap: 18px; }
.welcome { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px 20px; text-align: center; color: var(--p-text-muted-color); }
.welcome > .pi { font-size: 30px; color: var(--app-brand); background: var(--app-panel); padding: 20px; border-radius: 16px; }.welcome h2 { color: var(--app-text); font-size: 20px; }.welcome p { max-width: 410px; font-size: 13px; line-height: 1.8; }
.sidebar-empty { padding: 38px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; color: var(--p-text-muted-color); font-size: 13px; line-height: 1.7; }.sidebar-empty .pi { color: var(--app-brand); font-size: 19px; }
.empty-note { padding: 10px; font-size: 12px; color: var(--p-text-muted-color); line-height: 1.6; }
button:focus-visible, input:focus-visible, tr:focus-visible { outline: 2px solid var(--app-brand); outline-offset: 2px; }
fieldset:disabled { opacity: .6; }
@media (max-width: 1000px) { .browser-row { grid-template-columns: 215px minmax(0, 1fr); gap: 14px; }.submissions-panel, .data-panel { padding: 16px; }.search-wrap { width: 100%; } }
@media (max-width: 700px) { .browser-row { grid-template-columns: 1fr; }.types-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }.enterprise-types { margin: 0; padding: 0; border: 0; }.enterprise-types legend { float: none; }.reports-panel { min-height: 0; }.report-list { max-height: 240px; }.sidebar-empty { padding: 20px; }.data-panel { min-height: 360px; } }
@media (max-width: 400px) { .types-panel { grid-template-columns: 1fr; }.selection-table th, .selection-table td { padding: 9px 8px; } }
</style>
