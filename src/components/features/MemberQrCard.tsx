'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The customer's permanent loyalty QR — it encodes their user id and nothing
 * else, so it is the same code on every visit and for every campaign. Shown
 * once above the stamp cards rather than repeated on each of them.
 */

interface MemberQrCardProps {
    payload: string;
    /** Shown under the code so the customer can read it out if a scanner fails. */
    memberLabel?: string | null;
    onExpand: () => void;
}

export function MemberQrCard({ payload, memberLabel, onExpand }: MemberQrCardProps) {
    const { t } = useTranslation();

    return (
        <button
            type="button"
            onClick={onExpand}
            className="group flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 sm:gap-4 sm:p-5"
        >
            <span className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-zinc-100">
                <QRCodeSVG value={payload} size={72} level="M" marginSize={0} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-zinc-900">
                    <ScanLine size={15} className="shrink-0 text-primary" />
                    {t('rewards.memberQrTitle')}
                </span>
                <span className="mt-1 block text-xs leading-snug text-zinc-500">{t('rewards.memberQrHint')}</span>
                {memberLabel && (
                    <span className="mt-2 block truncate font-mono text-[11px] text-zinc-400">{memberLabel}</span>
                )}
            </span>

            <Maximize2 size={18} className="shrink-0 text-zinc-400 transition-colors group-hover:text-primary" />
        </button>
    );
}
