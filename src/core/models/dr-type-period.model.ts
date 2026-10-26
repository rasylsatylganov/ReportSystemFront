// Поля соответствуют Java Entity DrTypePeriod и JSON вашего контроллера.
export interface DrTypePeriod {
    id: number;
    codeTypePeriod: string;
    nameTypePeriod: string;
}

// В POST/PUT отправляем только редактируемые поля. ID для PUT находится в URL.
export interface DrTypePeriodRequest {
    codeTypePeriod: string;
    nameTypePeriod: string;
}
