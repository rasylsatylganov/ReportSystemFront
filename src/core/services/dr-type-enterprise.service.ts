import type { DrTypeEnterprise, DrTypeEnterpriseRequest } from '@/core/models/dr-type-enterprise.model';
import { DEFAULT_PAGE_SIZE, type PageResult } from '@/core/models/page.model';
import { http } from './http';

// Браузер обращается к Vite, а Vite пересылает /api на Java backend.
const URL = '/api/dr-type-enterprises';

export const drTypeEnterpriseService = {
    findPage(page = 0, size = DEFAULT_PAGE_SIZE): Promise<PageResult<DrTypeEnterprise>> {
        const query = new URLSearchParams({ page: String(page), size: String(size) });
        return http<PageResult<DrTypeEnterprise>>(`${URL}?${query}`);
    },

    getById(id: number): Promise<DrTypeEnterprise> {
        return http<DrTypeEnterprise>(`${URL}/${id}`);
    },

    create(data: DrTypeEnterpriseRequest): Promise<DrTypeEnterprise> {
        return http<DrTypeEnterprise>(URL, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update(id: number, data: DrTypeEnterpriseRequest): Promise<DrTypeEnterprise> {
        return http<DrTypeEnterprise>(`${URL}/${id}`, {
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
