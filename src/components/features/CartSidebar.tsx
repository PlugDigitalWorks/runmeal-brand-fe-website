'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Gift } from 'lucide-react';
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
                    <span className="font-medium flex gap-1 text-zinc-700">{t('profile.loyaltyTitle')} <span className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-white text-xs font-bold">₺</span></span>
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
