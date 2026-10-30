// Поля соответствуют Java Entity DrReference и JSON вашего контроллера.
export interface DrReference {
    id: number;
    sortIndex: number;
    codeReference: string;
    nameReference: string;
}

// В POST/PUT отправляем только редактируемые поля. ID для PUT находится в URL.
export interface DrReferenceRequest {
    codeReference: string;
    nameReference: string;
}
