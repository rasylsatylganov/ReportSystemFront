import type { DrEnterprise, DrEnterpriseRequest } from '@/core/models/dr-enterprise.model';
import { DEFAULT_PAGE_SIZE, type PageResult } from '@/core/models/page.model';
import { http } from './http';

const URL = '/api/dr-enterprises';

export const drEnterpriseService = {
    findPage(page = 0, size = DEFAULT_PAGE_SIZE, typeEnterpriseId: number | null = null): Promise<PageResult<DrEnterprise>> {
        const query = new URLSearchParams({ page: String(page), size: String(size) });
        if (typeEnterpriseId !== null) query.set('typeEnterpriseId', String(typeEnterpriseId));
        return http<PageResult<DrEnterprise>>(`${URL}?${query}`);
    },
    create(data: DrEnterpriseRequest): Promise<DrEnterprise> {
        return http<DrEnterprise>(URL, { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: number, data: DrEnterpriseRequest): Promise<DrEnterprise> {
        return http<DrEnterprise>(`${URL}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    remove(id: number): Promise<void> {
        return http<void>(`${URL}/${id}`, { method: 'DELETE' });
    },
    move(id: number, direction: 'up' | 'down', typeEnterpriseId: number | null): Promise<void> {
        const query = new URLSearchParams();
        if (typeEnterpriseId !== null) query.set('typeEnterpriseId', String(typeEnterpriseId));
        return http<void>(`${URL}/${id}/move-${direction}${query.size ? `?${query}` : ''}`, { method: 'POST' });
    },
};
