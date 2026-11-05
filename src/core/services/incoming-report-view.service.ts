import type { IncomingReportView } from '@/core/models/incoming-report-view.model';
import { http } from './http';

export const incomingReportViewService = {
    get(reportId: number, periodId: number, enterpriseId: number, page = 0, size = 20): Promise<IncomingReportView> {
        const query = new URLSearchParams({
            periodId: String(periodId), enterpriseId: String(enterpriseId), page: String(page), size: String(size),
        });
        return http(`/api/incoming-reports/${reportId}?${query}`);
    },
};
