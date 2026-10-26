// Общий помощник HTTP: проверяет статус и преобразует JSON в объект.
export class ApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

export async function http<T>(url: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers,
            },
        });
    } catch {
        throw new Error('Нет соединения с сервером. Проверьте запуск backend и Vite.');
    }

    // fetch сам не выбрасывает исключение при HTTP 400/404/500.
    if (!response.ok) {
        let message = '';
        try {
            const body = await response.json();
            if (typeof body.message === 'string') message = body.message;
        } catch {
            // Контроллер может вернуть ошибку без тела. Используем текст ниже.
        }

        if (!message) {
            switch (response.status) {
                case 400: message = 'Сервер отклонил данные. Проверьте заполнение полей.'; break;
                case 404: message = 'Запись или маршрут API не найден. Обновите список.'; break;
                case 409: message = 'Конфликт данных: код уже существует или запись используется.'; break;
                default: message = `Ошибка сервера (HTTP ${response.status}). Проверьте backend и его журнал.`;
            }
        }
        throw new ApiError(response.status, message);
    }

    // DELETE возвращает 204 No Content — JSON в таком ответе отсутствует.
    if (response.status === 204) return undefined as T;

    try {
        return await response.json() as T;
    } catch {
        throw new Error('Сервер вернул ответ без ожидаемого JSON. Проверьте маршрут API.');
    }
}
