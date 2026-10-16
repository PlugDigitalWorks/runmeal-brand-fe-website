'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { useBrand } from '@/context/BrandContext';
import { useStampCards, useStampQr } from '@/hooks/useLoyaltyStamps';
import { sortCardsByProgress } from '@/lib/loyalty-stamps';
import { StampCard } from '@/types/loyalty-stamp';
import { StampPass } from '@/components/features/StampPass';
import { StampPassCarousel } from '@/components/features/StampPassCarousel';
import { AddToAppleWalletButton } from '@/components/features/AddToAppleWalletButton';
import { AddToGoogleWalletButton } from '@/components/features/AddToGoogleWalletButton';

/**
 * The screen the customer holds up at the counter: each loyalty card drawn
 * like its Apple Wallet pass, with the scannable code on the card. This is a
 * full page rather than a modal because the gift button in the header links
 * straight to it.
 *
 * The code is the signed member QR the backend issues — static, so there is no
 * expiry countdown, and it carries no category choice: the manager sees every
 * card after scanning, so every pass shows the same code. Swiping only picks
 * which campaign the Wallet buttons save, and stamps are never added or
 * redeemed from here.
 */

/** "Gökhan Çalışkan" → "Gökhan Ç.", matching the name the Wallet pass prints. */
function shortName(firstName?: string | null, lastName?: string | null): string | null {
    const first = firstName?.trim();
    const initial = lastName?.trim().charAt(0).toLocaleUpperCase('tr-TR');
    if (!first) return null;
    return initial ? `${first} ${initial}.` : first;
}

export function MemberQrScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { brand } = useBrand();
    const { user, isLoading: isUserLoading } = useUser();
    const { qr, isLoading: isQrLoading, hasError: hasQrError, refresh: refreshQr } = useStampQr(user?.id);
    const { cards } = useStampCards(!!user);
    const [activeCampaignId, setActiveCampaignId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!isUserLoading && !user) router.replace('/login');
    }, [isUserLoading, user, router]);

    // Lead with whatever is closest to a reward, but keep the customer's pick
    // across the refreshes this screen does while it is open.
    React.useEffect(() => {
        if (!cards?.length) return;
        setActiveCampaignId((current) =>
            current && cards.some((card) => card.campaignId === current)
                ? current
                : sortCardsByProgress(cards)[0].campaignId,
        );
    }, [cards]);

    const activeCard = cards?.find((card) => card.campaignId === activeCampaignId) ?? null;
    const customerName = shortName(user?.firstName, user?.lastName);

    // A deep link (gift button from another tab, shared URL) has nothing to go
    // back to, so fall back to the wallet instead of leaving the site.
    const closeScreen = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/profile?tab=rewards');
    };

    const qrNode = qr?.qrValue ? (
        <QRCodeSVG
            value={qr.qrValue}
            level="M"
            marginSize={0}
            className="h-full w-full"
            aria-label={t('rewards.memberQrTitle')}
        />
    ) : hasQrError ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-2 text-center">
            <p className="text-xs text-zinc-500">{t('rewards.qrError')}</p>
            <button
                type="button"
                onClick={refreshQr}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-primary hover:text-primary"
            >
                <RefreshCw size={13} /> {t('rewards.retry')}
            </button>
        </div>
    ) : (
        <div className={`h-full w-full rounded bg-zinc-100 ${isQrLoading ? 'animate-pulse' : ''}`} />
    );

    const renderPass = (card: StampCard) => (
        <StampPass
            card={card}
            logoUrl={brand?.logoUrl ?? null}
            brandName={brand?.name ?? ''}
            customerName={customerName}
            qr={qrNode}
        />
    );

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

            {cards && cards.length > 1 ? (
                // Cards keep the API order; the carousel only opens on the leading one.
                <StampPassCarousel
                    cards={cards}
                    activeCampaignId={activeCampaignId}
                    onActiveChange={setActiveCampaignId}
                    renderCard={renderPass}
                />
            ) : (
                <div className="px-4">
                    {activeCard ? (
                        renderPass(activeCard)
                    ) : (
                        // No card yet (still loading, or no campaign): the code alone still works at the counter.
                        <div className="flex justify-center py-6">
                            <div className="h-[260px] w-[260px]">{qrNode}</div>
                        </div>
                    )}
                </div>
            )}

            <p className="mx-auto max-w-xs px-6 pt-5 text-center text-[13px] font-medium leading-relaxed text-zinc-600">
                {t('rewards.qrPageFooter')}
            </p>

            <div className="mt-auto space-y-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
                {/* Keyed by campaign so switching cards drops the previous card's
                    error and in-flight state. */}
                {activeCard && (
                    <React.Fragment key={activeCard.campaignId}>
                        <AddToAppleWalletButton brandId={activeCard.brandId} campaignId={activeCard.campaignId} />
                        <AddToGoogleWalletButton brandId={activeCard.brandId} campaignId={activeCard.campaignId} />
                    </React.Fragment>
                )}
            </div>
        </div>
        </div>
    );
}
