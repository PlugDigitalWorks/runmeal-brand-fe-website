import i18n from '@/i18n/config';

interface AxiosApiErrorLike {
    response?: {
        status?: number;
        data?: {
            code?: unknown;
            message?: unknown;
            statusCode?: unknown;
            data?: unknown;
        };
    };
}

export interface ApiErrorDetails {
    statusCode?: number;
    code: string | null;
    message: string | null;
    /** Interpolation values deliberately exposed by the API. */
    data: Record<string, unknown>;
}

/** Normalizes the API's standard error envelope without depending on Axios types. */
export function getApiErrorDetails(error: unknown): ApiErrorDetails {
    const response = (error as AxiosApiErrorLike)?.response;
    const envelope = response?.data;
    const serverStatus = typeof envelope?.statusCode === 'number' ? envelope.statusCode : undefined;

    return {
        statusCode: serverStatus ?? response?.status,
        code: typeof envelope?.code === 'string' && envelope.code ? envelope.code : null,
        message:
            typeof envelope?.message === 'string' && envelope.message.trim()
                ? envelope.message
                : error instanceof Error && error.message.trim()
                    ? error.message
                    : null,
        data:
            envelope?.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
                ? envelope.data as Record<string, unknown>
                : {},
    };
}

/**
 * Dashboard-compatible resolution order:
 * translated API code -> API message -> caller fallback -> translated generic.
 */
export function resolveApiErrorMessage(error: unknown, fallbackMessage?: string): string {
    const details = getApiErrorDetails(error);

    if (details.code) {
        const key = `apiErrors.${details.code}`;
        if (i18n.exists(key)) {
            return i18n.t(key, details.data);
        }
    }

    return details.message || fallbackMessage || i18n.t('common.errors.requestFailed');
}
