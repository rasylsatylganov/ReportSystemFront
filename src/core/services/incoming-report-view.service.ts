import type { IncomingReportView } from '@/core/models/incoming-report-view.model';
import type { PageResult } from '@/core/models/page.model';
import { http } from './http';

export interface IncomingReportSubmission {
    periodId: number; periodName: string;
    enterpriseId: number; enterpriseName: string; enterpriseCode: string;
}
export interface SubmittedIncomingReport { id: number; codeReportIn: string; nameReportIn: string }

export const incomingReportViewService = {
    submissions(typePeriodIds: number[], typeEnterpriseIds: number[], search = '', page = 0, size = 20): Promise<PageResult<IncomingReportSubmission>> {
        const query = new URLSearchParams({ typePeriodIds: typePeriodIds.join(','), typeEnterpriseIds: typeEnterpriseIds.join(','),
            page: String(page), size: String(size) });
        if (search.trim()) query.set('search', search.trim());
        return http(`/api/incoming-reports/submissions?${query}`);
    },
    submittedReports(periodId: number, enterpriseId: number, page = 0, size = 20): Promise<PageResult<SubmittedIncomingReport>> {
        const query = new URLSearchParams({ periodId: String(periodId), enterpriseId: String(enterpriseId), page: String(page), size: String(size) });
        return http(`/api/incoming-reports/submitted-templates?${query}`);
    },
    get(reportId: number, periodId: number, enterpriseId: number, page = 0, size = 20): Promise<IncomingReportView> {
        const query = new URLSearchParams({ periodId: String(periodId), enterpriseId: String(enterpriseId), page: String(page), size: String(size) });
        return http(`/api/incoming-reports/${reportId}?${query}`);
    },
};
