'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Coffee, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import {
    LoyaltyStampCard as StampCard,
    buildMemberQrPayload,
    fetchLoyaltyStampCards,
    resolveStampProgress,
} from '@/lib/mock-loyalty';

/**
 * The screen the customer holds up at the counter: membership card on top,
 * the scannable code below. This is a full page rather than a modal because
 * the gift button in the header links straight to it.
 *
 * The code is the customer's user id and never rotates, so there is no expiry
 * countdown here — the id itself is printed under the QR for the case where a
 * scanner will not read the screen.
 */

/** UUIDs are unreadable in one block; group them so they can be read aloud. */
const formatMemberId = (id: string) => id.replace(/-/g, ' ').toUpperCase();

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ percent }: { percent: number }) {
    return (
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="9" stroke="rgba(255,255,255,0.16)" />
            <circle
                cx="60"
                cy="60"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                stroke="var(--primary)"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
        </svg>
    );
}

export function MemberQrScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user, isLoading: isUserLoading } = useUser();
    const [cards, setCards] = React.useState<StampCard[] | null>(null);
    const [activeCardId, setActiveCardId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!isUserLoading && !user) router.replace('/login');
    }, [isUserLoading, user, router]);

    React.useEffect(() => {
        let cancelled = false;
        fetchLoyaltyStampCards()
            .then((result) => {
                if (cancelled) return;
                setCards(result);
                // Lead with whatever is closest to a reward.
                const featured = [...result].sort(
                    (a, b) => resolveStampProgress(b).percent - resolveStampProgress(a).percent,
                )[0];
                setActiveCardId(featured?.id ?? null);
            })
            .catch(() => {
                if (!cancelled) setCards([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const activeCard = cards?.find((card) => card.id === activeCardId) ?? null;
    const progress = activeCard ? resolveStampProgress(activeCard) : null;
    const payload = user?.id ? buildMemberQrPayload(user.id) : null;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

    // A deep link (gift button from another tab, shared URL) has nothing to go
    // back to, so fall back to the wallet instead of leaving the site.
    const closeScreen = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/profile?tab=rewards');
    };

    // Rendered as a fixed layer rather than a page body: the root layout keeps
    // the header and footer around every route, and this screen is meant to be
    // held up to a scanner with nothing else on it.
    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-white">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
            <div className="flex justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={closeScreen}
                    aria-label={t('common.close')}
                    className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                    <X size={22} />
                </button>
            </div>

            {/* Membership card */}
            <div className="px-4">
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900 px-5 py-5 text-white">
                    {/* Faint seal, the way a paper punch card carries a stamp. It
                        sits low and mostly off-canvas so it never fights the text. */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute -bottom-24 -right-16 h-48 w-48 rounded-full border-[10px] border-dashed border-white/[0.05]"
                    />

                    <div className="relative flex items-center gap-5">
                        <div className="relative shrink-0">
                            <ProgressRing percent={progress?.percent ?? 0} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                <Coffee size={26} className="text-white" />
                                <span className="text-sm font-semibold tabular-nums text-white/90">
                                    {progress ? `${progress.earned} / ${progress.target}` : '—'}
                                </span>
                            </div>
                        </div>

                        <div className="min-w-0 flex-1 text-right">
                            <p className="text-xs font-semibold uppercase leading-tight tracking-[0.12em] text-white/90 sm:text-sm">
                                {fullName || '—'}
                            </p>
                            {activeCard && (
                                <>
                                    <p className="mt-2 truncate text-xs text-white/45">{activeCard.merchantName}</p>
                                    <p className="mt-0.5 truncate text-sm font-medium text-white/80">
                                        {activeCard.rewardName}
                                    </p>
                                </>
                            )}
                            {progress?.isComplete ? (
                                <span className="mt-3 inline-block rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white">
                                    {t('rewards.readyToRedeem')}
                                </span>
                            ) : (
                                progress && (
                                    <p className="mt-3 text-xs text-white/50">
                                        {t('rewards.remaining', {
                                            remainingCount: progress.remaining,
                                            product: activeCard?.productName ?? '',
                                        })}
                                    </p>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Card switcher — only worth showing when there is more than one. */}
                {cards && cards.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                        {cards.map((card) => {
                            const isActive = card.id === activeCardId;
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => setActiveCardId(card.id)}
                                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${isActive
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                                        }`}
                                >
                                    {card.merchantName}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Instruction + code */}
            <div className="flex flex-1 flex-col items-center px-6 pt-7">
                <p className="max-w-xs text-center text-sm leading-relaxed text-zinc-600">
                    {t('rewards.qrPageInstruction')}
                </p>

                <div className="mt-6 w-full max-w-[260px]">
                    {payload ? (
                        <div className="aspect-square w-full">
                            <QRCodeSVG
                                value={payload}
                                level="M"
                                marginSize={0}
                                className="h-full w-full"
                                aria-label={t('rewards.memberQrTitle')}
                            />
                        </div>
                    ) : (
                        <div className="aspect-square w-full animate-pulse rounded-lg bg-zinc-100" />
                    )}
                </div>

                {user?.id && (
                    <p className="mt-5 break-all text-center font-mono text-sm tracking-wider text-zinc-900">
                        {formatMemberId(user.id)}
                    </p>
                )}

                <p className="mt-6 max-w-xs text-center text-xs font-semibold leading-relaxed text-zinc-700">
                    {t('rewards.qrPageNote')}
                </p>

                <p className="mt-3 text-center text-[11px] text-zinc-400">{t('rewards.qrPagePermanent')}</p>
            </div>

            <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
                <button
                    type="button"
                    onClick={() => router.push('/profile?tab=rewards')}
                    className="w-full rounded-full border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-primary hover:text-primary"
                >
                    {t('rewards.allCards')}
                </button>
            </div>
        </div>
        </div>
    );
}
