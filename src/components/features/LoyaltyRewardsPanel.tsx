'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Gift, History, PartyPopper, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { useStampCards, useStampQr } from '@/hooks/useLoyaltyStamps';
import { countAvailableRewards, resolveCardTitle } from '@/lib/loyalty-stamps';
import { StampCard } from '@/types/loyalty-stamp';
import { LoyaltyStampCardView } from '@/components/features/LoyaltyStampCard';
import { MemberQrCard } from '@/components/features/MemberQrCard';
import { GiftRevealOverlay } from '@/components/features/GiftRevealOverlay';

/**
 * Stamp-card wallet on the profile page.
 *
 * Cards come from `GET /loyalty/stamps/me/:brandId` and are rendered as sent —
 * stamps are only ever earned in-store, so nothing here increments a counter
 * optimistically. The scannable code lives on its own screen (`/rewards`);
 * everything here either links to it or hands off to it.
 *
 * A newly completed card plays the gift reveal once per browser session —
 * replaying it on every visit to the tab would get old fast — keyed by cycle
 * so the next filled card after a redemption reveals again.
 */

const REVEAL_SEEN_KEY = 'loyalty_reveal_seen';

const revealKey = (card: StampCard) => `${card.campaignId}:${card.cycleNumber}`;

const hasSeenReveal = (key: string) => {
    if (typeof window === 'undefined') return true;
    try {
        return sessionStorage.getItem(`${REVEAL_SEEN_KEY}:${key}`) === '1';
    } catch {
        return true;
    }
};

const markRevealSeen = (key: string) => {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(`${REVEAL_SEEN_KEY}:${key}`, '1');
    } catch {
        // Private mode: the reveal just replays next visit.
    }
};

export function LoyaltyRewardsPanel() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useUser();
    const { qr, isLoading: isQrLoading, hasError: hasQrError, refresh: refreshQr } = useStampQr(user?.id);
    const { cards, isLoading, hasError, refresh } = useStampCards(!!user);
    const [revealCard, setRevealCard] = React.useState<StampCard | null>(null);

    // Auto-play for the first waiting reward this session has not shown yet.
    React.useEffect(() => {
        if (!cards) return;

        const earned = cards.find((card) => card.status === 'REWARD_AVAILABLE');
        if (!earned || hasSeenReveal(revealKey(earned))) return;

        markRevealSeen(revealKey(earned));
        setRevealCard(earned);
    }, [cards]);

    const readyCount = cards ? countAvailableRewards(cards) : 0;

    // The reveal hands off to the QR — that is what the customer needs next.
    const closeReveal = () => {
        setRevealCard(null);
        router.push('/rewards');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
                        <Gift className="h-4 w-4" /> {t('rewards.title')}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">{t('rewards.subtitle')}</p>
                </div>

                <button
                    type="button"
                    onClick={() => router.push('/rewards/history')}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-primary hover:text-primary"
                >
                    <History size={13} /> {t('rewards.history.link')}
                </button>
            </div>

            <MemberQrCard
                payload={qr?.qrValue ?? null}
                isLoading={isQrLoading}
                hasError={hasQrError}
                onRetry={refreshQr}
                onExpand={() => router.push('/rewards')}
            />

            {readyCount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                    <PartyPopper className="h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm font-medium text-zinc-800">{t('rewards.readyBanner', { rewardCount: readyCount })}</p>
                </div>
            )}

            {/* A failed refresh keeps the last good cards on screen behind a retry. */}
            {hasError && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">{t('rewards.loadError')}</p>
                    <button
                        type="button"
                        onClick={refresh}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                    >
                        <RefreshCw size={13} /> {t('rewards.retry')}
                    </button>
                </div>
            )}

            {cards === null ? (
                isLoading || !hasError ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                        {[0, 1].map((key) => (
                            <div key={key} className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
                        ))}
                    </div>
                ) : null
            ) : cards.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
                        <Gift className="h-8 w-8 text-zinc-300" />
                    </div>
                    <p className="text-zinc-500">{t('rewards.empty')}</p>
                </div>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                    {cards.map((card) => (
                        <LoyaltyStampCardView key={card.campaignId} card={card} />
                    ))}
                </div>
            )}

            {revealCard && (
                <GiftRevealOverlay
                    rewardName={revealCard.campaignName}
                    merchantName={resolveCardTitle(revealCard)}
                    onClose={closeReveal}
                />
            )}
        </div>
    );
}
