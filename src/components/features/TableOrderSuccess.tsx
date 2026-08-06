'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { resolveCurrencySymbol } from '@/lib/utils';
import type { TablePayLaterOrder } from '@/types/table';

/**
 * Confirmation for a pay-later table order. The response from
 * `POST /orders/table/pay-later` is itself the confirmation — the order is
 * already in the kitchen and already sitting in the table's open check, so
 * nothing here needs to poll or verify anything.
 */
export function TableOrderSuccess({
    order,
    backToMenuHref,
}: {
    order: TablePayLaterOrder;
    backToMenuHref: string;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-[50vh] items-center justify-center px-4">
            <div className="w-full max-w-md rounded-lg border border-zinc-100 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle size={32} className="text-green-600" />
                </div>

                <h1 className="text-2xl font-bold text-zinc-800">{t('table.success.title')}</h1>
                <p className="mt-2 text-zinc-600">
                    {order.tableLabel
                        ? t('table.success.sentToTable', { table: order.tableLabel })
                        : t('table.success.sent')}
                </p>

                <dl className="mt-6 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-left text-sm">
                    <div className="flex justify-between gap-3">
                        <dt className="text-zinc-500">{t('table.success.total')}</dt>
                        <dd className="font-bold text-zinc-800">
                            {formatCurrency(order.totalPrice, resolveCurrencySymbol(order.currency))}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-zinc-500">{t('table.success.payment')}</dt>
                        <dd className="font-medium text-zinc-800">{t('table.success.payAtCounter')}</dd>
                    </div>
                </dl>

                <p className="mt-4 text-xs text-zinc-500">{t('table.success.counterHint')}</p>

                <Link
                    href={backToMenuHref}
                    className="mt-6 inline-block w-full rounded-lg bg-primary py-3 font-bold text-white transition-opacity hover:opacity-90"
                >
                    {t('table.success.orderMore')}
                </Link>
            </div>
        </div>
    );
}
