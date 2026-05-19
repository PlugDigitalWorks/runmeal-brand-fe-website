'use client';

import React from 'react';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function CartContent() {
    const { cart, guestCartItems, cartTotal, removeFromCart, updateQuantity } = useCart();
    const { isAuthenticated, openAuthModal } = useAuth();

    // Unified items view
    const items = isAuthenticated
        ? cart?.items || []
        : guestCartItems;

    const hasItems = items.length > 0;

    // Hardcoded values for demo matching image (discounts etc)
    const discount = 0;
    const finalTotal = cartTotal - discount;

    return (
        <div className="space-y-4">
            {/* Carts */}
            <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                <div className="bg-primary p-3 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">My Cart</h3>
                    <ShoppingCart size={20} />
                </div>

                <div className="p-4">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400 text-sm">
                            Your cart is empty.
                        </div>
                    ) : (
                        <div className="space-y-4 mb-4">
                            {items.map((item: any) => (
                                <div key={isAuthenticated ? item.id : item.productId} className="pb-4 border-b border-zinc-100 last:border-0">
                                    <div>
                                        <h4 className="font-bold text-sm text-zinc-800">{item.productName || item.name || 'Product'}</h4>
                                        {/* Options */}
                                        {item.options && item.options.length > 0 && (
                                            <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                                                {item.options.map((group: any, gIdx: number) => (
                                                    <div key={gIdx} className="flex flex-col">
                                                        {group.selections?.map((sel: any, sIdx: number) => (
                                                            <div key={sIdx}>
                                                                <span className="font-medium">{group.groupName}:</span> {sel.optionName}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Addons */}
                                        {item.addons && item.addons.length > 0 && (
                                            <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                                                {item.addons.map((addon: any, idx: number) => (
                                                    <div key={idx}>+ {addon.name}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    const currentQty = item.qty || item.quantity;
                                                    if (currentQty <= 1) {
                                                        removeFromCart(isAuthenticated ? item.id : item.productId);
                                                    } else {
                                                        updateQuantity(isAuthenticated ? item.id : item.productId, currentQty - 1);
                                                    }
                                                }}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${(item.qty || item.quantity) <= 1
                                                    ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                                                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                                                    }`}
                                            >
                                                {(item.qty || item.quantity) <= 1 ? (
                                                    <Trash2 size={14} />
                                                ) : (
                                                    <Minus size={14} />
                                                )}
                                            </button>
                                            <span className="w-8 text-center font-bold text-sm text-zinc-800">
                                                {item.qty || item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(isAuthenticated ? item.id : item.productId, (item.qty || item.quantity) + 1)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <div className="font-bold text-zinc-800 text-sm">
                                            {((item.price || 0) * (item.qty || item.quantity)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {hasItems && (
                        <div className="space-y-2 text-sm text-zinc-600 pt-2 border-t border-zinc-100">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{cartTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Total Discounts</span>
                                    <span>-{discount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold text-zinc-800 pt-2 border-t border-zinc-100 mt-2">
                                <span>Cart Total</span>
                                <span>{finalTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                            </div>

                            <button
                                onClick={() => {
                                    if (!isAuthenticated) {
                                        openAuthModal();
                                    } else {
                                        // Navigate to checkout page
                                        window.location.href = '/checkout';
                                    }
                                }}
                                className="w-full bg-primary text-white font-bold py-3 rounded mt-4 hover:opacity-90 transition-opacity uppercase"
                            >
                                Confirm Order
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
