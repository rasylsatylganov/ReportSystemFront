import type { DesignerLookups, IncomingReport, ReportTemplate, ReportTemplateRequest } from '@/core/models/report-template.model';
import type { PageResult } from '@/core/models/page.model';
import { http } from './http';

const URL = '/api/incoming-report-templates';
export const reportTemplateService = {
    list(page = 0, size = 20): Promise<PageResult<IncomingReport>> {
        return http(`${URL}?${new URLSearchParams({ page: String(page), size: String(size) })}`);
    },
    get(id: number): Promise<ReportTemplate> { return http(`${URL}/${id}`); },
    lookups(): Promise<DesignerLookups> { return http(`${URL}/lookups`); },
    validate(data: ReportTemplateRequest): Promise<void> {
        return http(`${URL}/validate`, { method: 'POST', body: JSON.stringify(data) });
    },
    create(data: ReportTemplateRequest): Promise<ReportTemplate> {
        return http(URL, { method: 'POST', body: JSON.stringify(data) });
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
