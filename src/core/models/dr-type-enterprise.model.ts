// Поля соответствуют Java Entity DrTypeEnterprise и JSON вашего контроллера.
export interface DrTypeEnterprise {
    id: number;
    sortIndex: number;
    codeTypeEnterprise: string;
    nameTypeEnterprise: string;
}

// В POST/PUT отправляем только редактируемые поля. ID для PUT находится в URL.
export interface DrTypeEnterpriseRequest {
    codeTypeEnterprise: string;
    nameTypeEnterprise: string;
}
