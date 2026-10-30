import type { DrTypePeriod, DrTypePeriodRequest } from '@/core/models/dr-type-period.model';
import { DEFAULT_PAGE_SIZE, type PageResult } from '@/core/models/page.model';
import { http } from './http';

// Браузер обращается к Vite, а Vite пересылает /api на Java backend.
const URL = '/api/dr-type-periods';

export const drTypePeriodService = {
    findPage(page = 0, size = DEFAULT_PAGE_SIZE): Promise<PageResult<DrTypePeriod>> {
        const query = new URLSearchParams({ page: String(page), size: String(size) });
        return http<PageResult<DrTypePeriod>>(`${URL}?${query}`);
    },

    getById(id: number): Promise<DrTypePeriod> {
        return http<DrTypePeriod>(`${URL}/${id}`);
    },

    create(data: DrTypePeriodRequest): Promise<DrTypePeriod> {
        return http<DrTypePeriod>(URL, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update(id: number, data: DrTypePeriodRequest): Promise<DrTypePeriod> {
        return http<DrTypePeriod>(`${URL}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    moveUp(id: number): Promise<void> {
        return http<void>(`${URL}/${id}/move-up`, { method: 'POST' });
    },

    moveDown(id: number): Promise<void> {
        return http<void>(`${URL}/${id}/move-down`, { method: 'POST' });
    },

    remove(id: number): Promise<void> {
        return http<void>(`${URL}/${id}`, { method: 'DELETE' });
    },
};
