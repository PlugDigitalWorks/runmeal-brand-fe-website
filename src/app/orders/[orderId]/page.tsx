'use client';

import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CreditCard, MapPin, Package, ReceiptText, Store, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { branchService } from '@/services/branch.service';
import { orderService, Order, OrderDetails } from '@/services/order.service';
import { OrderPromotionSnapshots } from '@/components/features/OrderPromotionSnapshots';
import { DiscountedLinePrice } from '@/components/ui/DiscountedLinePrice';
import { RUNMEAL_LOGO } from '@/lib/constants';
import {
    formatOrderDateTime,
    getOrderDisplayId,
    getOrderItemLineTotal,
    getOrderItemOptionLines,
    getOrderItemQty,
    getOrderItemUnitPrice,
    getOrderSubtotal,
    toNumber,
} from '@/lib/order-display';
import type { Branch } from '@/types/branch';
import { Money } from '@/components/ui/Money';

const PAYMENT_METHOD_KEYS: Record<string, string> = {
    ONLINE_CARD: 'checkout.payment.onlineCard',
    CASH: 'checkout.payment.cash',
    CARD_ON_DELIVERY: 'checkout.payment.cardOnDelivery',
    PAY_AT_COUNTER: 'orders.payAtCounter',
};

function statusClasses(status: string) {
    const normalized = status?.toLowerCase();
    if (normalized === 'delivered' || normalized === 'completed') return 'bg-green-100 text-green-700';
    if (normalized === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-blue-100 text-blue-700';
}

function OrderDetailContent() {
    const { t, i18n } = useTranslation();
    const params = useParams<{ orderId: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();

    const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [branch, setBranch] = useState<Branch | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR';

    useEffect(() => {
        let cancelled = false;

        async function loadOrder() {
            if (!orderId) return;

            setIsLoading(true);
            setError(null);

            try {
                let branchId = searchParams.get('branchId') || '';
                let brandId = searchParams.get('brandId') || '';

                // Deep links and refreshes arrive without the ids the profile
                // page passes along, so the customer list fills them back in.
                if (!branchId || !brandId) {
                    const orders = await orderService.getMyOrders();
                    const listOrder: Order | undefined = orders.find((item) => item.id === orderId);
                    branchId = branchId || listOrder?.branchId || '';
                    brandId = brandId || listOrder?.brandId || '';
                }

                if (!branchId || !brandId) throw new Error('Order branch information is missing.');

                const details = await orderService.getOrderById(orderId, branchId, brandId);
                if (cancelled) return;
                setOrder(details);

                try {
                    const branchDetails = await branchService.getBranchDetails(branchId);
                    if (!cancelled) setBranch(branchDetails);
                } catch (branchError) {
                    // The order stands on its own; the branch card just loses its name.
                    console.error('Failed to fetch branch details', branchError);
                    if (!cancelled) setBranch(null);
                }
            } catch (loadError) {
                console.error('Failed to fetch order detail', loadError);
                if (!cancelled) setError(t('orders.loadError'));
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        loadOrder();

        return () => {
            cancelled = true;
        };
    }, [orderId, searchParams, t]);

    const subtotal = useMemo(
        () => (order ? getOrderSubtotal(order, order.items ?? []) : 0),
        [order],
    );

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-3xl px-4 py-16 text-center text-zinc-500">
                {t('orders.loading')}
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="container mx-auto max-w-3xl px-4 py-8">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                >
                    <ArrowLeft className="h-4 w-4" /> {t('orders.back')}
                </button>
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-red-500 shadow-sm">
                    {error || t('orders.loadError')}
                </div>
            </div>
        );
    }

    const orderCurrency = order.currency;
    const discountAmount = toNumber(order.discountAmount);
    const creditUsedAmount = toNumber(order.creditUsedAmount);
    const taxAmount = toNumber(order.taxAmount);
    const branchName = branch?.name || t('orders.branchFallback');
    const branchAddress = branch?.addressText || '-';
    const logoUrl = branch?.logoUrl || RUNMEAL_LOGO;
    const paymentMethodKey = order.paymentMethod ? PAYMENT_METHOD_KEYS[order.paymentMethod] : undefined;

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8">
            <button
                type="button"
                onClick={() => router.back()}
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
                <ArrowLeft className="h-4 w-4" /> {t('orders.back')}
            </button>

            <div className="space-y-6">
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
                            <Image src={logoUrl} alt={branchName} fill sizes="80px" className="object-cover" unoptimized />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-bold text-zinc-900 break-words">{branchName}</h1>
                                    <p className="mt-1 text-sm text-zinc-600">
                                        {t('orders.orderedAt', { date: formatOrderDateTime(order.createdAt, locale) })}
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-zinc-700">
                                        {t('orders.orderNo', { id: getOrderDisplayId(order) })}
                                    </p>
                                </div>
                                <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium capitalize ${statusClasses(order.status)}`}>
                                    {order.status}
                                </span>
                            </div>

                            {order.scheduledDate && order.scheduledTime && (
                                <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                                    <span className="font-semibold">
                                        {order.orderType === 'SCHEDULED_PICKUP'
                                            ? t('profile.scheduledPickup')
                                            : t('profile.scheduledDelivery')}:
                                    </span>{' '}
                                    {order.scheduledDate} {order.scheduledTime}
                                </div>
                            )}

                            <div className="mt-6 space-y-4">
                                <div className="flex gap-3">
                                    <Store className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
                                    <div className="min-w-0">
                                        <p className="text-sm text-zinc-500">{t('orders.orderedFrom')}</p>
                                        <p className="font-medium text-zinc-900">{branchName}</p>
                                        <p className="text-sm text-zinc-600 break-words">{branchAddress}</p>
                                    </div>
                                </div>

                                {order.tableLabel ? (
                                    <div className="flex gap-3">
                                        <UtensilsCrossed className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-zinc-500">{t('orders.table')}</p>
                                            <p className="font-medium text-zinc-900">{order.tableLabel}</p>
                                        </div>
                                    </div>
                                ) : order.addressText ? (
                                    <div className="flex gap-3">
                                        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-zinc-500">{t('orders.deliveredTo')}</p>
                                            <p className="font-medium text-zinc-900 break-words">{order.addressText}</p>
                                            {order.phone && <p className="text-sm text-zinc-600">{order.phone}</p>}
                                        </div>
                                    </div>
                                ) : null}

                                {order.note && (
                                    <div className="flex gap-3">
                                        <ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-zinc-500">{t('orders.orderNote')}</p>
                                            <p className="text-sm font-medium text-zinc-900 break-words">{order.note}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
                        <h2 className="flex items-center gap-2 font-semibold text-zinc-900">
                            <ReceiptText className="h-4 w-4 text-primary" /> {t('orders.orderSummary')}
                        </h2>
                    </div>

                    <div className="space-y-5 p-6">
                        <div className="space-y-4">
                            {(order.items ?? []).map((item) => (
                                <div key={item.id} className="flex gap-4">
                                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                                        <Package className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="font-medium text-zinc-900 break-words">
                                                    {getOrderItemQty(item)}x {item.productName}
                                                </p>
                                                <p className="text-xs text-zinc-500">
                                                    {t('orders.unit')}: <Money value={getOrderItemUnitPrice(item)} currency={orderCurrency} />
                                                </p>
                                            </div>
                                            <DiscountedLinePrice
                                                lineTotal={getOrderItemLineTotal(item)}
                                                discountAmount={item.discountAmount}
                                                finalLineTotal={item.finalLineTotal}
                                                fallbackTotal={getOrderItemLineTotal(item)}
                                                currency={orderCurrency}
                                                className="shrink-0 text-right font-semibold text-zinc-900"
                                            />
                                        </div>
                                        {getOrderItemOptionLines(item).map((line) => (
                                            <p key={line} className="mt-1 text-sm leading-relaxed text-zinc-600 break-words">
                                                {line}
                                            </p>
                                        ))}
                                        {item.note && (
                                            <p className="mt-1 text-sm text-zinc-500 break-words">
                                                <span className="font-medium">{t('cart.note')}:</span> {item.note}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <OrderPromotionSnapshots
                            snapshot={order.internalPromotionSnapshot}
                            currency={orderCurrency}
                        />

                        <div className="space-y-3 border-t border-zinc-200 pt-5">
                            <div className="flex justify-between text-zinc-700">
                                <span>{t('orders.subtotal')}</span>
                                <span><Money value={subtotal} currency={orderCurrency} /></span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>{t('orders.discount')}</span>
                                    <span>-<Money value={discountAmount} currency={orderCurrency} /></span>
                                </div>
                            )}
                            {creditUsedAmount > 0 && (
                                <div className="flex justify-between text-zinc-700">
                                    <span>{t('orders.walletUsed')}</span>
                                    <span>-<Money value={creditUsedAmount} currency={orderCurrency} /></span>
                                </div>
                            )}
                            {taxAmount > 0 && (
                                <div className="flex justify-between text-zinc-700">
                                    <span>{t('orders.taxIncluded')}</span>
                                    <span><Money value={taxAmount} currency={orderCurrency} /></span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-zinc-200 pt-3 text-lg font-bold text-zinc-900">
                                <span>{t('orders.total')}</span>
                                <span className="text-primary"><Money value={order.totalPrice} currency={orderCurrency} /></span>
                            </div>
                        </div>

                        {order.paymentMethod && (
                            <div className="flex items-center justify-between border-t border-zinc-200 pt-5">
                                <div className="flex items-center gap-2 font-medium text-zinc-900">
                                    <CreditCard className="h-5 w-5 text-zinc-400" />
                                    {t('orders.paymentMethod')}
                                </div>
                                <span className="text-zinc-700">
                                    {paymentMethodKey ? t(paymentMethodKey) : order.paymentMethod}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OrderDetailPage() {
    const { t } = useTranslation();
    return (
        <Suspense
            fallback={
                <div className="container mx-auto max-w-3xl px-4 py-16 text-center text-zinc-500">
                    {t('orders.loading')}
                </div>
            }
        >
            <OrderDetailContent />
        </Suspense>
    );
}
