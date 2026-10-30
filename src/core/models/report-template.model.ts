import type { DrTypePeriod } from '@/core/models/dr-type-period.model';
import type { DrTypeEnterprise } from '@/core/models/dr-type-enterprise.model';
import type { DrReference } from '@/core/models/dr-reference.model';
import type { DrReferenceItem } from '@/core/models/dr-reference-item.model';

export interface TypePosition { id: number; nameTypePosition: string }
export interface TypeField { id: number; codeTypeField: string; nameTypeField: string }
export interface IncomingReport {
    id: number; codeReportIn: string; nameReportIn: string;
    typePeriod: DrTypePeriod; typeEnterprise: DrTypeEnterprise;
    indexRowScanBegin: number; indexRowScanEnd: number;
}
export interface ReportTemplate {
    report: IncomingReport;
    references: { id: number; reference: DrReference; typePosition: TypePosition; indexNum: number; orderSort: number | null }[];
    fields: { id: number; referenceItem: DrReferenceItem; typeFieldValue: TypeField; indexColumn: number;
        orderSort: number | null; isRequired: number }[];
    revision: string;
}
export interface ReportTemplateRequest {
    report: { codeReportIn: string; nameReportIn: string; typePeriod: { id: number | null };
        typeEnterprise: { id: number | null }; indexRowScanBegin: number | null; indexRowScanEnd: number | null };
    references: { id: number | null; referenceId: number | null; typePositionId: number | null;
        indexNum: number | null; orderSort: number | null }[];
    fields: { id: number | null; referenceItemId: number | null; typeFieldValueId: number | null;
        indexColumn: number | null; orderSort: number | null; isRequired: number }[];
    revision: string | null;
}
export interface DesignerLookups { positions: TypePosition[]; fieldTypes: TypeField[] }
export interface EditorReference {
    key: number; id: number | null; referenceId: number | null; positionId: number | null;
    indexNum: number | null; orderSort: number | null;
}
export interface EditorField {
    key: number; parentKey: number; id: number | null; itemId: number | null;
    typeId: number | null; column: number | null; orderSort: number | null; required: boolean;
}
