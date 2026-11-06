export interface IncomingReportImportResult {
    filename: string;
    typePeriodId: number;
    typeEnterpriseId: number;
    periodId: number;
    periodName: string;
    enterpriseId: number;
    enterpriseName: string;
    totalRows: number;
    totalValues: number;
    sheets: { sheetName: string; reportId: number; rowsImported: number; valuesImported: number;
        firstDataRow: number; lastDataRow: number }[];
}
