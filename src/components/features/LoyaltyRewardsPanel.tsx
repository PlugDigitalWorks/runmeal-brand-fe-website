'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Gift, PartyPopper, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import {
    LoyaltyStampCard as StampCard,
    buildMemberQrPayload,
    fetchLoyaltyStampCards,
    resolveStampProgress,
} from '@/lib/mock-loyalty';
import { LoyaltyStampCardView } from '@/components/features/LoyaltyStampCard';
import { MemberQrCard } from '@/components/features/MemberQrCard';
import { GiftRevealOverlay } from '@/components/features/GiftRevealOverlay';

/**
 * Stamp-card wallet on the profile page.
 *
 * The scannable code lives on its own screen (`/rewards`); everything here
 * either links to it or hands off to it.
 *
 * Data is mocked (`@/lib/mock-loyalty`) until the backend ships the endpoint.
 * A completed card plays the gift reveal once per browser session — replaying
 * it on every visit to the tab would get old fast — and the "replay" button
 * exists so the animation can be reviewed without resetting that flag.
 */

const REVEAL_SEEN_KEY = 'loyalty_reveal_seen';

const hasSeenReveal = (cardId: string) => {
    if (typeof window === 'undefined') return true;
    try {
        return sessionStorage.getItem(`${REVEAL_SEEN_KEY}:${cardId}`) === '1';
    } catch {
        return true;
    }
};

const markRevealSeen = (cardId: string) => {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(`${REVEAL_SEEN_KEY}:${cardId}`, '1');
    } catch {
        // Private mode: the reveal just replays next visit.
    }
};

export function LoyaltyRewardsPanel() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useUser();
    const [cards, setCards] = React.useState<StampCard[] | null>(null);
    const [revealCard, setRevealCard] = React.useState<StampCard | null>(null);

    const qrPayload = user?.id ? buildMemberQrPayload(user.id) : null;

    React.useEffect(() => {
        let cancelled = false;
        fetchLoyaltyStampCards()
            .then((result) => {
                if (cancelled) return;
                setCards(result);

                // Auto-play for the first completed card the user has not seen yet.
                const completed = result.find((card) => resolveStampProgress(card).isComplete);
                if (completed && !hasSeenReveal(completed.id)) {
                    markRevealSeen(completed.id);
                    setRevealCard(completed);
                }
            })
            .catch(() => {
                if (!cancelled) setCards([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const completedCard = cards?.find((card) => resolveStampProgress(card).isComplete) ?? null;
    const readyCount = cards?.filter((card) => resolveStampProgress(card).isComplete).length ?? 0;

    // The reveal hands off to the QR — that is what the customer needs next.
    const closeReveal = () => {
        setRevealCard(null);
        if (qrPayload) router.push('/rewards');
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

                {/* Temporary: lets us review the reveal without earning a reward. */}
                {completedCard && (
                    <button
                        type="button"
                        onClick={() => setRevealCard(completedCard)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                        <Sparkles size={13} /> {t('rewards.replayAnimation')}
                    </button>
                )}
            </div>

            {qrPayload && (
                <MemberQrCard
                    payload={qrPayload}
                    memberLabel={user?.id ?? null}
                    onExpand={() => router.push('/rewards')}
                />
            )}

            {readyCount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                    <PartyPopper className="h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm font-medium text-zinc-800">{t('rewards.readyBanner', { rewardCount: readyCount })}</p>
                </div>
            )}

            {cards === null ? (
                <div className="grid gap-5 sm:grid-cols-2">
                    {[0, 1].map((key) => (
                        <div key={key} className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
                    ))}
                </div>
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
                        <LoyaltyStampCardView key={card.id} card={card} />
                    ))}
                </div>
            )}

            {revealCard && (
                <GiftRevealOverlay
                    rewardName={revealCard.rewardName}
                    merchantName={revealCard.merchantName}
                    onClose={closeReveal}
                />
            )}

        </div>
    );
}
