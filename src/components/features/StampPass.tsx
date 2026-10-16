'use client';

import React from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { StampCard } from '@/types/loyalty-stamp';
import { resolveStampProgress } from '@/lib/loyalty-stamps';
import { StampStrip, StampStripState, WALLET_ORANGE } from '@/components/features/StampStrip';

/**
 * One loyalty card drawn the way Apple Wallet draws its storeCard pass, so
 * the screen and the saved pass match: logo and status in the header, the
 * stamp strip, campaign / stamps left / customer fields, and the QR on the
 * card itself. Mirrors the field rules of runmeal-api `apple-wallet.service.ts`.
 */

interface StampPassProps {
    card: StampCard;
    logoUrl: string | null;
    brandName: string;
    /** Already shortened ("Gökhan Ç."), the way the Wallet pass prints it. */
    customerName: string | null;
    /** The member QR, or its loading / error placeholder. */
    qr: React.ReactNode;
}

function resolvePassState(card: StampCard): StampStripState {
    if (card.status === 'REWARD_AVAILABLE') return 'ready';
    return card.campaignStatus === 'ACTIVE' ? 'collecting' : 'paused';
}

function PassField({ label, value, align = 'left' }: { label: string; value: string; align?: 'left' | 'right' }) {
    return (
        <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
            <p className="whitespace-nowrap text-[11px] font-semibold leading-tight tracking-[0.06em]">
                {label}
            </p>
            <p className="mt-0.5 truncate text-base font-light leading-snug">{value}</p>
        </div>
    );
}

export function StampPass({ card, logoUrl, brandName, customerName, qr }: StampPassProps) {
    const { t, i18n } = useTranslation();
    const progress = resolveStampProgress(card);
    const state = resolvePassState(card);

    const status =
        state === 'ready'
            ? t('rewards.pass.ready')
            : state === 'paused'
              ? t('rewards.pass.paused')
              : `${progress.earned} / ${progress.target}`;

    const expiresAt = card.rewardExpiresAt ? new Date(card.rewardExpiresAt) : null;
    const expires =
        expiresAt && !Number.isNaN(expiresAt.getTime())
            ? expiresAt.toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
              })
            : null;

    return (
        <div
            className="overflow-hidden rounded-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_rgba(246,146,30,0.28),0_2px_6px_rgba(0,0,0,0.12)]"
            style={{ backgroundColor: WALLET_ORANGE }}
        >
            <div className="flex min-h-[58px] items-start justify-between gap-3 px-4 pb-2.5 pt-3.5">
                {logoUrl ? (
                    <Image
                        src={logoUrl}
                        alt={brandName}
                        width={160}
                        height={50}
                        unoptimized
                        className="h-7 w-auto min-w-0 max-w-[45%] shrink object-contain object-left"
                    />
                ) : (
                    <p className="truncate text-lg font-semibold">{brandName}</p>
                )}
                <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold leading-tight tracking-[0.06em]">
                        {t('rewards.pass.status')}
                    </p>
                    <p
                        className={`mt-0.5 whitespace-nowrap text-lg font-light leading-snug tabular-nums ${state === 'collecting' ? 'tracking-[0.08em]' : ''}`}
                    >
                        {status}
                    </p>
                </div>
            </div>

            <StampStrip count={progress.earned} threshold={progress.target} state={state} />

            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2.5 px-4 pt-3">
                <PassField label={t('rewards.pass.campaign')} value={card.campaignName} />
                {state === 'ready' ? (
                    expires ? <PassField label={t('rewards.pass.expires')} value={expires} /> : <span />
                ) : (
                    <PassField label={t('rewards.pass.remaining')} value={String(progress.remaining)} />
                )}
                {customerName ? <PassField label={t('rewards.pass.customer')} value={customerName} align="right" /> : <span />}
            </div>

            <div className="flex justify-center px-4 pb-[22px] pt-[26px]">
                <div className="h-[200px] w-[200px] rounded-md bg-white p-2.5">{qr}</div>
            </div>
        </div>
    );
}
