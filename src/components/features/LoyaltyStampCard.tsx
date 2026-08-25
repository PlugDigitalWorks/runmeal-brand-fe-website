'use client';

import React from 'react';
import { Check, Coffee, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoyaltyStampCard as StampCard, resolveStampProgress } from '@/lib/mock-loyalty';

/**
 * One "buy N, get one free" card: the stamp grid and the progress copy.
 *
 * There is deliberately no QR here — the code the cashier scans is the
 * customer's own id, identical for every campaign, so the wallet renders it
 * once (`MemberQrCard`) instead of repeating the same image on each card.
 */

interface LoyaltyStampCardProps {
    card: StampCard;
}

export function LoyaltyStampCardView({ card }: LoyaltyStampCardProps) {
    const { t, i18n } = useTranslation();
    const progress = resolveStampProgress(card);

    const expiryLabel = card.expiresAt
        ? new Date(card.expiresAt).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : null;

    return (
        <div
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${progress.isComplete ? 'border-primary/40 ring-1 ring-primary/20' : 'border-zinc-200'
                }`}
        >
            {/* Header */}
            <div className="relative overflow-hidden bg-primary px-5 py-4 text-white">
                {/* Soft brand wash so the header does not read as a flat block. */}
                <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
                <span className="pointer-events-none absolute -bottom-12 -left-6 h-24 w-24 rounded-full bg-black/5" />

                <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{card.merchantName}</p>
                        <p className="mt-0.5 truncate text-xs text-white/80">{card.productName}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap">
                        {t('rewards.buyGet', { target: progress.target })}
                    </span>
                </div>
            </div>

            <div className="space-y-5 p-5">
                {/* Stamp grid */}
                <div>
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: progress.target }, (_, index) => {
                            const isFilled = index < progress.earned;
                            const isLastFilled = index === progress.earned - 1;
                            return (
                                <span
                                    key={index}
                                    aria-hidden
                                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${isFilled
                                        ? 'border-primary bg-primary text-white'
                                        : 'border-dashed border-zinc-200 bg-zinc-50 text-zinc-300'
                                        } ${isLastFilled ? 'stamp-pop' : ''}`}
                                >
                                    <Coffee size={16} />
                                </span>
                            );
                        })}
                    </div>
                    <p className="sr-only">{t('rewards.progressAria', { earned: progress.earned, target: progress.target })}</p>
                </div>

                {/* Progress bar + counter */}
                <div className="space-y-2">
                    <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-zinc-900">
                            {progress.earned} <span className="text-zinc-400">/ {progress.target}</span>
                        </span>
                        <span className={progress.isComplete ? 'text-xs font-semibold text-primary' : 'text-xs text-zinc-500'}>
                            {progress.isComplete
                                ? t('rewards.readyToRedeem')
                                : t('rewards.remaining', { remainingCount: progress.remaining, product: card.productName })}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                </div>

                {/* Reward line */}
                <div
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${progress.isComplete ? 'bg-primary/10 text-zinc-900' : 'bg-zinc-50 text-zinc-600'
                        }`}
                >
                    <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${progress.isComplete ? 'bg-primary text-white' : 'bg-white text-zinc-400 border border-zinc-200'
                            }`}
                    >
                        {progress.isComplete ? <Check size={17} /> : <Gift size={17} />}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{card.rewardName}</p>
                        <p className="text-xs leading-snug text-zinc-500">
                            {progress.isComplete ? t('rewards.rewardWaiting') : t('rewards.rewardPending')}
                        </p>
                    </div>
                </div>

                {expiryLabel && (
                    <p className="text-center text-[11px] text-zinc-400">{t('rewards.validUntil', { date: expiryLabel })}</p>
                )}
            </div>
        </div>
    );
}
