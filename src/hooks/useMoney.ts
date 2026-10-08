'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '@/context/BrandContext';
import { currencySymbol, formatMoney } from '@/lib/money';

/**
 * Price formatting bound to the brand currency. Pass `currency` to format in
 * another one — a placed order keeps its own `order.currency`.
 * `currency` is null until the brand has one (e.g. local dev on the env
 * fallback); render `<Money>` or a placeholder then, never a guessed currency.
 */
export function useMoney() {
    const { brand } = useBrand();
    const { i18n } = useTranslation();
    const language = i18n.resolvedLanguage || i18n.language;
    const brandCurrency = brand?.currency || null;

    const format = useCallback(
        (value: number | string | null | undefined, currency?: string | null) => {
            const code = currency || brandCurrency;
            return code ? formatMoney(value, code, language) : '';
        },
        [brandCurrency, language],
    );

    const symbol = useCallback(
        (currency?: string | null) => {
            const code = currency || brandCurrency;
            return code ? currencySymbol(code, language) : '';
        },
        [brandCurrency, language],
    );

    return { currency: brandCurrency, format, symbol };
}
