'use client';

import React, { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { ShoppingCart, X } from 'lucide-react';
import { CartContent } from './CartContent';
import { createPortal } from 'react-dom';

export function MobileCartFab() {
    const [isOpen, setIsOpen] = useState(false);
    const { cart, guestCartItems } = useCart();
    const { isAuthenticated } = useAuth();

    // Calculate total items
    const items = isAuthenticated ? cart?.items || [] : guestCartItems;
    const totalItems = items.reduce((acc: number, item: any) => acc + (item.qty || item.quantity || 0), 0);

    const toggleCart = () => setIsOpen(!isOpen);

    // Don't show if empty? Optional. User didn't specify. 
    // Usually good to show empty cart too so they can check status.

    return (
        <>
            {/* FAB */}
            <button
                onClick={toggleCart}
                className="fixed bottom-6 right-6 z-40 bg-primary text-white p-4 rounded-full shadow-lg lg:hidden hover:bg-orange-600 transition-colors flex items-center justify-center"
                aria-label="Open Cart"
            >
                <div className="relative">
                    <ShoppingCart size={24} />
                    {totalItems > 0 && (
                        <span className="absolute -top-3 -right-3 bg-white text-primary text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-primary">
                            {totalItems}
                        </span>
                    )}
                </div>
            </button>

            {/* Modal / Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 lg:hidden font-sans">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Content */}
                    <div className="absolute bottom-0 right-0 left-0 bg-zinc-50 rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
                        {/* Handle / Header */}
                        <div className="flex justify-between items-center p-4 border-b border-zinc-200 bg-white rounded-t-2xl shrink-0">
                            <h2 className="font-bold text-lg text-zinc-800">Your Cart</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Scrollable Area */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <CartContent />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
