import type { IncomingReport } from './report-template.model';
import type { DrPeriod } from './dr-period.model';
import type { DrEnterprise } from './dr-enterprise.model';
import type { PageResult } from './page.model';

export interface ReportViewColumn {
    key: string; name: string; groupKey: string | null; groupName: string | null;
    dataType: string; dimension: boolean;
}
export interface ReportViewCell { value: string | null; groupKey: string | null }
export interface ReportViewRow { indexRow: number; cells: ReportViewCell[] }
export interface IncomingReportView {
    report: IncomingReport;
    period: DrPeriod;
    enterprise: DrEnterprise;
    columns: ReportViewColumn[];
    rows: PageResult<ReportViewRow>;
}
