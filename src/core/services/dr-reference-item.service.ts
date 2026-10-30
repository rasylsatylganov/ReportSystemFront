import type { DrReferenceItem, DrReferenceItemRequest } from '@/core/models/dr-reference-item.model';
import { DEFAULT_PAGE_SIZE, type PageResult } from '@/core/models/page.model';
import { http } from './http';

const URL = '/api/dr-reference-items';

export const drReferenceItemService = {
    findPage(page = 0, size = DEFAULT_PAGE_SIZE, referenceId: number | null = null): Promise<PageResult<DrReferenceItem>> {
        const query = new URLSearchParams({ page: String(page), size: String(size) });
        if (referenceId !== null) query.set('referenceId', String(referenceId));
        return http<PageResult<DrReferenceItem>>(`${URL}?${query}`);
    },
    create(data: DrReferenceItemRequest): Promise<DrReferenceItem> {
        return http<DrReferenceItem>(URL, { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: number, data: DrReferenceItemRequest): Promise<DrReferenceItem> {
        return http<DrReferenceItem>(`${URL}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    remove(id: number): Promise<void> {
        return http<void>(`${URL}/${id}`, { method: 'DELETE' });
    },
    move(id: number, direction: 'up' | 'down', referenceId: number | null): Promise<void> {
        const query = new URLSearchParams();
        if (referenceId !== null) query.set('referenceId', String(referenceId));
        return http<void>(`${URL}/${id}/move-${direction}${query.size ? `?${query}` : ''}`, { method: 'POST' });
    },
};
