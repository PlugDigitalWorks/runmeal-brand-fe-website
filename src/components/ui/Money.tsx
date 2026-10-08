'use client';

import { useMoney } from '@/hooks/useMoney';

interface MoneyProps {
    value: number | string | null | undefined;
    /** Defaults to the brand currency; pass `order.currency` for a placed order. */
    currency?: string | null;
    className?: string;
}

/** A formatted price, or a skeleton while no currency is known yet. */
export function Money({ value, currency, className }: MoneyProps) {
    const { format } = useMoney();
    const text = format(value, currency);

    if (!text) {
        return (
            <span
                aria-hidden="true"
                className={`inline-block h-[1em] w-12 animate-pulse rounded bg-zinc-200 align-middle ${className ?? ''}`}
            />
        );
    }

    return <span className={className}>{text}</span>;
}
