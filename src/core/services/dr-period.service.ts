import type { DrPeriod, DrPeriodRequest } from '@/core/models/dr-period.model';
import { DEFAULT_PAGE_SIZE, type PageResult } from '@/core/models/page.model';
import { http } from './http';

const URL = '/api/dr-periods';

export const drPeriodService = {
    findPage(page = 0, size = DEFAULT_PAGE_SIZE, typePeriodId: number | null = null): Promise<PageResult<DrPeriod>> {
        const query = new URLSearchParams({ page: String(page), size: String(size) });
        if (typePeriodId !== null) query.set('typePeriodId', String(typePeriodId));
        return http<PageResult<DrPeriod>>(`${URL}?${query}`);
    },
    create(data: DrPeriodRequest): Promise<DrPeriod> {
        return http<DrPeriod>(URL, { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: number, data: DrPeriodRequest): Promise<DrPeriod> {
        return http<DrPeriod>(`${URL}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    remove(id: number): Promise<void> {
        return http<void>(`${URL}/${id}`, { method: 'DELETE' });
    },
    move(id: number, direction: 'up' | 'down', typePeriodId: number | null): Promise<void> {
        const query = new URLSearchParams();
        if (typePeriodId !== null) query.set('typePeriodId', String(typePeriodId));
        return http<void>(`${URL}/${id}/move-${direction}${query.size ? `?${query}` : ''}`, { method: 'POST' });
    },
};
