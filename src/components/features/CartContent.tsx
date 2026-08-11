'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTable } from '@/context/TableContext';
import { formatCurrency } from '@/lib/utils';
import { useBranch } from '@/context/BranchContext';

type CartContentItem = {
    id?: string;
    productId: string;
    productName?: string | null;
    name?: string | null;
    price?: number;
    note?: string | null;
    notes?: string;
    currencySymbol?: string;
    qty?: number;
    quantity?: number;
    options?: {
        groupName?: string;
        selections?: {
            optionName?: string;
        }[];
    }[];
    addons?: {
        name?: string;
    }[];
};

export function CartContent() {
    const { cart, guestCartItems, cartTotal, removeFromCart, updateQuantity } = useCart();
    const { isAuthenticated, openAuthModal } = useAuth();
    const { isTableMode } = useTable();
    const { availability, isAvailabilityLoading } = useBranch();
    const { t } = useTranslation();
    const router = useRouter();

    // A QR customer already has a (guest) session by the time items exist, so
    // the login wall the storefront puts in front of checkout must not appear.
    const handleCheckout = () => {
        if (isTableMode) {
            router.push('/order/checkout');
            return;
        }

        if (!isAuthenticated) {
            openAuthModal();
            return;
        }

        window.location.href = '/checkout';
    };

    // Unified items view
    const items: CartContentItem[] = isAuthenticated
        ? cart?.items || []
        : guestCartItems;

    const hasItems = items.length > 0;

    // For authenticated carts the backend totals (totalCartPrice, discountAmount,
    // finalPrice) are the single source of truth; guests have no discounts.
    const discount = isAuthenticated ? (cart?.discountAmount ?? 0) : 0;
    const finalTotal = isAuthenticated
        ? (cart?.finalPrice ?? cartTotal - discount)
        : cartTotal;

    return (
        <div className="space-y-4">
            {/* Carts */}
            <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                <div className="bg-primary p-3 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">{t('cart.myCart')}</h3>
                    <ShoppingCart size={20} />
                </div>

                <div className="p-4">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400 text-sm">
                            {t('cart.empty')}
                        </div>
                    ) : (
                        <div className="space-y-4 mb-4">
                            {items.map((item) => {
                                const itemId = item.id || item.productId;
                                const itemQuantity = item.qty ?? item.quantity ?? 0;
                                const itemNote = item.note ?? item.notes;

                                return (
                                    <div key={itemId} className="pb-4 border-b border-zinc-100 last:border-0">
                                        <div>
                                            <h4 className="font-bold text-sm text-zinc-800">{item.productName || item.name || t('product.product')}</h4>
                                            {/* Options */}
                                            {item.options && item.options.length > 0 && (
                                                <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                                                    {item.options.map((group, gIdx) => (
                                                        <div key={gIdx} className="flex flex-col">
                                                            {group.selections?.map((sel, sIdx) => (
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
                                                    {item.addons.map((addon, idx) => (
                                                        <div key={idx}>+ {addon.name}</div>
                                                    ))}
                                                </div>
                                            )}
                                            {itemNote && (
                                                <p className="mt-1 text-xs text-zinc-500 break-words">
                                                    <span className="font-medium">{t('cart.note')}:</span> {itemNote}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (itemQuantity <= 1) {
                                                            removeFromCart(itemId);
                                                        } else {
                                                            updateQuantity(itemId, itemQuantity - 1);
                                                        }
                                                    }}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${itemQuantity <= 1
                                                        ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                                                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                                                        }`}
                                                >
                                                    {itemQuantity <= 1 ? (
                                                        <Trash2 size={14} />
                                                    ) : (
                                                        <Minus size={14} />
                                                    )}
                                                </button>
                                                <span className="w-8 text-center font-bold text-sm text-zinc-800">
                                                    {itemQuantity}
                                                </span>
                                                <button
                                                    onClick={() => updateQuantity(itemId, itemQuantity + 1)}
                                                    disabled={isAvailabilityLoading || !availability?.canAcceptOrders}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            <div className="font-bold text-zinc-800 text-sm">
                                                {formatCurrency((item.price || 0) * itemQuantity, item.currencySymbol)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {hasItems && (
                        <div className="space-y-2 text-sm text-zinc-600 pt-2 border-t border-zinc-100">
                            <div className="flex justify-between">
                                <span>{t('cart.subtotal')}</span>
                                <span>{formatCurrency(cartTotal)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>{t('cart.totalDiscounts')}</span>
                                    <span>{formatCurrency(-discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold text-zinc-800 pt-2 border-t border-zinc-100 mt-2">
                                <span>{t('cart.total')}</span>
                                <span>{formatCurrency(finalTotal)}</span>
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={isAvailabilityLoading || !availability?.canAcceptOrders}
                                className="w-full bg-primary text-white font-bold py-3 rounded mt-4 hover:opacity-90 transition-opacity uppercase disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t('cart.confirmOrder')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
