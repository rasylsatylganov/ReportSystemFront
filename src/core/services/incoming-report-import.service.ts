import type { IncomingReportImportResult } from '@/core/models/incoming-report-import.model';
import { http } from './http';

export const incomingReportImportService = {
    upload(file: File): Promise<IncomingReportImportResult> {
        const body = new FormData();
        body.append('file', file);
        return http('/api/incoming-reports/import', { method: 'POST', body });
    },
};
