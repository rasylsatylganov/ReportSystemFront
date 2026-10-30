import type { DrReference } from '@/core/models/dr-reference.model';

export interface DrReferenceItem {
    id: number;
    sortIndex: number;
    reference: DrReference;
    codeReferenceItem: string;
    nameReferenceItem: string;
}

export interface DrReferenceItemRequest {
    reference: { id: number };
    codeReferenceItem: string;
    nameReferenceItem: string;
}
