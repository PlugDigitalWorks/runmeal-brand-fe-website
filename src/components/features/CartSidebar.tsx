'use client';

import React, { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Gift } from 'lucide-react';
import { CartContent } from './CartContent';
import Link from 'next/link';
import Image from 'next/image';
import { walletService } from '@/services/wallet.service';

export function CartSidebar() {
    const { isAuthenticated } = useAuth();
    const [balance, setBalance] = useState<number>(0);

    useEffect(() => {
        if (isAuthenticated) {
            walletService.getBalance()
                .then(res => setBalance(res.balance))
                .catch(err => console.error('Failed to fetch wallet balance', err));
        }
    }, [isAuthenticated]);

    return (
        <div className="hidden lg:block w-full lg:w-80 flex-shrink-0 space-y-4">
            {/* Points - Only for Authenticated Users */}
            {isAuthenticated && (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-zinc-100 flex justify-between items-center">
                    <span className="font-medium flex gap-1 text-zinc-700">Cash Points <span className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-white text-xs font-bold">₺</span></span>
                    <span className="font-bold text-zinc-800">{balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                </div>
            )}

            {/* Carts */}
            <CartContent />

            {isAuthenticated && (
                <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                    <div className="p-3 border-b border-zinc-100 flex justify-between items-center">
                        <h3 className="font-bold text-zinc-800">My Rewards</h3>
                        <Gift size={20} className="text-yellow-500" />
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-sm text-zinc-500 mb-3">No rewards used!</p>
                        <button className="border border-zinc-300 rounded px-4 py-1 text-sm font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                            My Rewards →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
