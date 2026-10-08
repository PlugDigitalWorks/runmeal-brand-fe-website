/**
 * Every price on the storefront goes through here. The currency always comes
 * from the API (brand currency from `/brands/resolve`, or `order.currency` for
 * a placed order) — there is deliberately no default.
 */

export function moneyLocale(language?: string | null): string {
    return language?.startsWith('en') ? 'en-US' : 'tr-TR';
}

export function formatMoney(
    value: number | string | null | undefined,
    currency: string,
    language?: string | null,
): string {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat(moneyLocale(language), {
        style: 'currency',
        currency,
        // "₺45,00" / "£4.50" rather than "TRY 45.00" when the locale has no symbol of its own.
        currencyDisplay: 'narrowSymbol',
    }).format(Number.isFinite(amount) ? amount : 0);
}

/** Just the symbol, e.g. "£" for GBP. */
export function currencySymbol(currency: string, language?: string | null): string {
    return (
        new Intl.NumberFormat(moneyLocale(language), {
            style: 'currency',
            currency,
            currencyDisplay: 'narrowSymbol',
        })
            .formatToParts(0)
            .find((part) => part.type === 'currency')?.value ?? currency
    );
}
