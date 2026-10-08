'use client';

import React from 'react';
import Image from 'next/image';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGoogleWalletPass } from '@/hooks/useLoyaltyStamps';

/**
 * "Add to Google Wallet" for one stamp campaign card.
 *
 * The pass is registered with Google by the backend and carries the same member
 * QR as the in-app wallet; this button only requests a fresh save link and
 * sends the browser to it. On Android that opens the Google Wallet "Add" sheet.
 * iPhone and iPad never see the button (they get Apple Wallet instead), and on
 * a desktop it stays usable with a hint that the pass lands on the customer's
 * Android phone through their Google account.
 *
 * Google's brand rules require the official badge, so the button face is the
 * unmodified SVG from the Wallet brand guidelines (TR / en-US variants) — never
 * a custom label, never stretched.
 */

const BADGE_WIDTH = 283;
const BADGE_HEIGHT = 50;

interface AddToGoogleWalletButtonProps {
    brandId: string;
    campaignId: string;
}

export function AddToGoogleWalletButton({ brandId, campaignId }: AddToGoogleWalletButtonProps) {
    const { t, i18n } = useTranslation();
    const { platform, isCreating, error, add } = useGoogleWalletPass(brandId, campaignId);

    if (platform === 'unsupported') return null;

    const badgeLanguage = (i18n.resolvedLanguage || i18n.language || 'tr').startsWith('en') ? 'en' : 'tr';

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={add}
                disabled={isCreating}
                aria-busy={isCreating}
                aria-label={isCreating ? t('rewards.googleWallet.creating') : t('rewards.googleWallet.add')}
                className="relative mx-auto flex h-11 w-fit max-w-full items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-wait"
            >
                <Image
                    src={`/images/wallet/add-to-google-wallet-${badgeLanguage}.svg`}
                    alt=""
                    width={BADGE_WIDTH}
                    height={BADGE_HEIGHT}
                    unoptimized
                    className={`h-full w-auto ${isCreating ? 'opacity-50' : ''}`}
                />
                {isCreating && (
                    <Loader2 size={18} className="absolute animate-spin text-white" aria-hidden />
                )}
            </button>

            {platform === 'desktop' && !error && (
                <p className="text-center text-[11px] leading-snug text-zinc-400">{t('rewards.googleWallet.desktopHint')}</p>
            )}

            {error && (
                <p role="alert" className="flex items-start gap-1.5 text-[11px] leading-snug text-red-600">
                    <AlertCircle size={12} className="mt-px shrink-0" aria-hidden /> {error}
                </p>
            )}
        </div>
    );
}
