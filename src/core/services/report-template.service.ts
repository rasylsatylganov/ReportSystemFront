import type { DesignerLookups, IncomingReport, ReportMetadataAccess, ReportTemplate, ReportTemplateRequest } from '@/core/models/report-template.model';
import type { PageResult } from '@/core/models/page.model';
import { http } from './http';

const URL = '/api/incoming-report-templates';
export const reportTemplateService = {
    list(page = 0, size = 20, typePeriodId: number | null = null,
         typeEnterpriseId: number | null = null): Promise<PageResult<IncomingReport>> {
        const query = new URLSearchParams({ page: String(page), size: String(size) });
        if (typePeriodId !== null) query.set('typePeriodId', String(typePeriodId));
        if (typeEnterpriseId !== null) query.set('typeEnterpriseId', String(typeEnterpriseId));
        return http(`${URL}?${query}`);
    },
    metadataAccess(typePeriodId: number, typeEnterpriseId: number): Promise<ReportMetadataAccess> {
        const query = new URLSearchParams({ typePeriodId: String(typePeriodId), typeEnterpriseId: String(typeEnterpriseId) });
        return http(`${URL}/metadata-access?${query}`);
    },
    get(id: number): Promise<ReportTemplate> { return http(`${URL}/${id}`); },
    lookups(): Promise<DesignerLookups> { return http(`${URL}/lookups`); },
    validate(data: ReportTemplateRequest): Promise<void> {
        return http(`${URL}/validate`, { method: 'POST', body: JSON.stringify(data) });
    },
    create(data: ReportTemplateRequest): Promise<ReportTemplate> {
        return http(URL, { method: 'POST', body: JSON.stringify(data) });
    },
    async copy(id: number, typePeriodId: number, typeEnterpriseId: number): Promise<ReportTemplate> {
        const source = await reportTemplateService.get(id);
        const report = source.report;
        return reportTemplateService.create({
            report: {
                codeReportIn: report.codeReportIn, nameReportIn: report.nameReportIn,
                typePeriod: { id: typePeriodId }, typeEnterprise: { id: typeEnterpriseId },
                indexRowScanBegin: report.indexRowScanBegin, indexRowScanEnd: report.indexRowScanEnd,
            },
            references: source.references.map(ref => ({
                id: null, referenceId: ref.reference.id, typePositionId: ref.typePosition.id,
                indexNum: ref.indexNum, orderSort: ref.orderSort,
            })),
            fields: source.fields.map(field => ({
                id: null, referenceItemId: field.referenceItem.id, typeFieldValueId: field.typeFieldValue.id,
                indexColumn: field.indexColumn, orderSort: field.orderSort, isRequired: field.isRequired,
            })),
            revision: null,
        });
    },
    update(id: number, data: ReportTemplateRequest): Promise<ReportTemplate> {
        return http(`${URL}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    remove(id: number): Promise<void> { return http(`${URL}/${id}`, { method: 'DELETE' }); },
};

export async function allPages<T>(fetchPage: (page: number, size: number) => Promise<PageResult<T>>): Promise<T[]> {
    const items: T[] = [];
    let page = 0;
    while (true) {
        const result = await fetchPage(page, 100);
        if (!Array.isArray(result.content)) throw new Error('Сервер вернул неверный формат справочника.');
        items.push(...result.content);
        if (++page >= result.totalPages) return items;
    }
}
