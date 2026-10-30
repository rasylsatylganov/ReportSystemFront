import type { DrTypePeriod } from '@/core/models/dr-type-period.model';

export interface DrPeriod {
    id: number;
    sortIndex: number;
    typePeriod: DrTypePeriod;
    codePeriod: string;
    namePeriod: string;
    dateBegin: string;
    dateEnd: string;
}

export interface DrPeriodRequest {
    typePeriod: { id: number };
    codePeriod: string;
    namePeriod: string;
    dateBegin: string;
    dateEnd: string;
}
