import type { ReportViewColumn, ReportViewRow } from '@/core/models/incoming-report-view.model';

export function groupSpans(columns: ReportViewColumn[], rows: ReportViewRow[]): number[][] {
    const spans = rows.map(() => columns.map(() => 1));
    columns.forEach((column, index) => {
        if (!column.dimension) return;
        for (let start = 0; start < rows.length;) {
            const cell = rows[start].cells[index];
            let end = start + 1;
            if (cell?.groupKey != null) {
                while (end < rows.length && rows[end].cells[index]?.groupKey === cell.groupKey) end++;
            }
            spans[start][index] = end - start;
            for (let row = start + 1; row < end; row++) spans[row][index] = 0;
            start = end;
        }
    });
    return spans;
}

export function displayValue(value: string | null, type: string): string {
    if (value === null) return '';
    if (type !== 'DATETIME') return value;
    // Oracle DATE has no time zone: display the stored date/time without shifting the day.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/.exec(value);
    if (!match) return value;
    const [, year, month, day, hour, minute, second = '00', fraction = ''] = match;
    const date = `${day}.${month}.${year}`;
    return hour === '00' && minute === '00' && second === '00' && !fraction
        ? date : `${date} ${hour}:${minute}:${second}${fraction}`;
}
