'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Gift, Info } from 'lucide-react';
import { CartContent } from './CartContent';
import { walletService } from '@/services/wallet.service';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function CartSidebar() {
    const { isAuthenticated, isGuest } = useAuth();
    const [balance, setBalance] = useState<number>(0);
    const { t } = useTranslation();

    // A QR guest is authenticated but owns no wallet or rewards — showing them
    // an account panel with a zero balance is just noise.
    const hasAccount = isAuthenticated && !isGuest;

    useEffect(() => {
        if (hasAccount) {
            walletService.getBalance()
                .then(res => setBalance(res.balance))
                .catch(err => console.error('Failed to fetch wallet balance', err));
        }
    }, [hasAccount]);

    return (
        <div className="hidden lg:block w-full lg:w-80 flex-shrink-0 space-y-4">
            {/* Points - Only for Authenticated Users */}
            {hasAccount && (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-zinc-100 flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-zinc-700">
                        <span className="font-medium">{t('profile.loyaltyTitle')}</span>
                        <span className="group relative inline-flex">
                            <button
                                type="button"
                                aria-label={t('profile.loyaltyInfoLabel')}
                                aria-describedby="loyalty-balance-tooltip"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-orange-50 hover:text-primary focus-visible:bg-orange-50 focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                <Info size={15} aria-hidden="true" />
                            </button>
                            <span
                                id="loyalty-balance-tooltip"
                                role="tooltip"
                                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                            >
                                {t('profile.loyaltyNote')}
                                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
                            </span>
                        </span>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">₺</span>
                    </div>
                    <span className="font-bold text-zinc-800">{formatCurrency(balance)}</span>
                </div>
            )}

            {/* Carts */}
            <CartContent />

            {hasAccount && (
                <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                    <div className="p-3 border-b border-zinc-100 flex justify-between items-center">
                        <h3 className="font-bold text-zinc-800">{t('cart.rewardsTitle')}</h3>
                        <Gift size={20} className="text-yellow-500" />
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-sm text-zinc-500 mb-3">{t('cart.noRewards')}</p>
                        <button className="border border-zinc-300 rounded px-4 py-1 text-sm font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                            {t('cart.rewardsTitle')} →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
