'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import type { TableJourneyError as TableJourneyErrorCode } from '@/types/table';

/**
 * Dead end for a QR journey that cannot start. Each case gets its own copy so
 * the customer knows whether to re-scan, ask staff, or just browse — and no
 * menu/cart call is made for a table we could not resolve.
 */
export function TableJourneyError({ error }: { error: TableJourneyErrorCode }) {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-[50vh] items-center justify-center px-4">
            <div className="w-full max-w-md rounded-lg border border-zinc-100 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
                    <QrCode size={26} className="text-primary" />
                </div>
                <h1 className="text-xl font-bold text-zinc-800">{t(`table.journeyErrors.${error}.title`)}</h1>
                <p className="mt-2 text-sm text-zinc-500">{t(`table.journeyErrors.${error}.description`)}</p>
                <Link
                    href="/"
                    className="mt-6 inline-block w-full rounded-lg bg-primary py-3 font-bold text-white transition-opacity hover:opacity-90"
                >
                    {t('table.journeyErrors.backHome')}
                </Link>
            </div>
        </div>
    );
}
