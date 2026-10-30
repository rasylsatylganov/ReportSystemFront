import type { DrTypeEnterprise } from '@/core/models/dr-type-enterprise.model';

export interface DrEnterprise {
    id: number;
    sortIndex: number;
    typeEnterprise: DrTypeEnterprise;
    codeEnterprise: string;
    nameEnterprise: string;
}

export interface DrEnterpriseRequest {
    typeEnterprise: { id: number };
    codeEnterprise: string;
    nameEnterprise: string;
}
