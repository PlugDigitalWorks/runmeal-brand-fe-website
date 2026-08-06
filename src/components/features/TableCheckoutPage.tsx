'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
    ChevronLeft,
    CreditCard,
    CheckCircle,
    ShoppingBag,
    Utensils,
    Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/context/BranchContext';
import { useCart } from '@/context/CartContext';
import { useTable } from '@/context/TableContext';
import { orderService } from '@/services/order.service';
import { paymentService } from '@/services/payment.service';
import { isPickupAvailable } from '@/lib/branch-details';
import { resolveTableOrderError } from '@/lib/table-order-errors';
import { formatCurrency } from '@/lib/utils';
import { TableJourneyError } from '@/components/features/TableJourneyError';
import { TableOrderSuccess } from '@/components/features/TableOrderSuccess';
import type { TableFulfillment, TableOrderView, TablePaymentChoice } from '@/types/table';

/**
 * Checkout for a QR table journey.
 *
 * Deliberately separate from the storefront `CheckoutPage`: there is no
 * delivery address, no address coverage check and no cash/card-at-the-door
 * choice here. Two very different submits live behind the same button —
 * `POST /payments/initialize` for pay now, `POST /orders/table/pay-later` for
 * pay at the counter — and only one of them creates an order immediately.
 */
export function TableCheckoutPage() {
    const router = useRouter();
    const { t } = useTranslation();
    const { journey, status, error, refreshOptions } = useTable();
    const { selectedBranch } = useBranch();
    const { cart, cartTotal, isLoading: isCartLoading, resetCartState, refreshCart } = useCart();

    const [fulfillment, setFulfillment] = React.useState<TableFulfillment>('TABLE');
    const [paymentChoice, setPaymentChoice] = React.useState<TablePaymentChoice | null>(null);
    const [note, setNote] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [placedOrder, setPlacedOrder] = React.useState<TableOrderView | null>(null);

    const cartId = cart?.id || cart?.cartId;
    const cartItems = cart?.items || [];
    const payNow = journey?.checkoutOptions.payNow ?? false;
    const payLater = journey?.checkoutOptions.payLater ?? false;
    const pickupAvailable = isPickupAvailable(selectedBranch);
    const totalToPay = cart?.finalPrice ?? cart?.totalCartPrice ?? cartTotal;

    // Never render a choice that the backend would reject; if only one table
    // option is live it is preselected so there is nothing to get wrong.
    React.useEffect(() => {
        if (fulfillment !== 'TABLE') return;

        setPaymentChoice((current) => {
            if (current === 'PAY_NOW' && payNow) return current;
            if (current === 'PAY_LATER' && payLater) return current;
            if (payNow) return 'PAY_NOW';
            if (payLater) return 'PAY_LATER';
            return null;
        });
    }, [fulfillment, payNow, payLater]);

    // Table ordering may have been switched off since the scan — fall back to
    // pickup rather than showing a table checkout that cannot succeed.
    React.useEffect(() => {
        if (!payNow && !payLater && pickupAvailable) {
            setFulfillment('PICKUP');
        }
    }, [payNow, payLater, pickupAvailable]);

    const backToMenuHref = journey ? `/order?qr=${encodeURIComponent(journey.qrToken)}` : '/order';

    /** Applies whatever recovery the backend's error asks for. */
    const handleCheckoutError = async (submitError: unknown, submittedCartId: string) => {
        const resolved = resolveTableOrderError(submitError);
        toast.error(resolved.message);

        switch (resolved.action) {
            case 'REFRESH_QR':
                await refreshOptions();
                break;
            case 'RESET_CART': {
                // The cart is spent but the error does not say which order
                // consumed it, so look it up before dropping local state —
                // otherwise the customer is bounced back to the menu with no
                // idea their order already exists.
                const existingOrder = journey
                    ? await orderService
                        .findOrderByCartId(submittedCartId, journey.branchId)
                        .catch(() => null)
                    : null;

                resetCartState();

                if (existingOrder) {
                    setPlacedOrder(existingOrder);
                } else {
                    router.replace(backToMenuHref);
                }
                break;
            }
            case 'KEEP_PAYMENT':
                // A payment already owns this cart. Do not start another one
                // and do not fall through to pay later — that is how a table
                // ends up billed twice.
                await refreshCart();
                break;
            default:
                break;
        }
    };

    const handleSubmit = async () => {
        if (!journey || !cartId || isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (fulfillment === 'PICKUP') {
                const response = await paymentService.initializePayment({
                    cartId,
                    branchId: journey.branchId,
                    paymentMethod: 'ONLINE_CARD',
                    orderType: 'PICKUP',
                    note,
                });

                if (response.paymentUrl) {
                    window.location.href = response.paymentUrl;
                    return;
                }
                toast.error(t('table.errors.PAYMENT_INIT_FAILED'));
                return;
            }

            if (paymentChoice === 'PAY_NOW') {
                const response = await paymentService.initializePayment({
                    cartId,
                    branchId: journey.branchId,
                    paymentMethod: 'ONLINE_CARD',
                    orderType: 'TABLE_ORDER',
                    tableId: journey.tableId,
                    note,
                });

                if (response.paymentUrl) {
                    // The order does not exist yet — the backend creates it
                    // only after the provider verifies the payment.
                    window.location.href = response.paymentUrl;
                    return;
                }
                toast.error(t('table.errors.PAYMENT_INIT_FAILED'));
                return;
            }

            if (paymentChoice === 'PAY_LATER') {
                const order = await orderService.createTablePayLaterOrder({
                    cartId,
                    tableId: journey.tableId,
                    branchId: journey.branchId,
                    note,
                });

                // The backend already deactivated the cart and sent the order
                // to the kitchen, so this response *is* the confirmation.
                setPlacedOrder(order);
                resetCartState();
                return;
            }

            toast.error(t('table.errors.GENERIC'));
        } catch (submitError) {
            console.error('Table checkout failed', submitError);
            await handleCheckoutError(submitError, cartId);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (placedOrder && journey) {
        return <TableOrderSuccess order={placedOrder} backToMenuHref={backToMenuHref} />;
    }

    if (status === 'error' && error) {
        return <TableJourneyError error={error} />;
    }

    if (!journey) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-zinc-500">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
                <p className="text-sm">{t('table.resolving')}</p>
            </div>
        );
    }

    // Deliberately an explicit state rather than a redirect: the cart loads
    // asynchronously, and bouncing back to the menu on the first render (when
    // it is legitimately still empty) would make checkout unreachable.
    if (!isCartLoading && cartItems.length === 0) {
        return (
            <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
                <ShoppingBag size={32} className="text-zinc-300" />
                <p className="text-zinc-500">{t('table.checkout.emptyCart')}</p>
                <button
                    onClick={() => router.push(backToMenuHref)}
                    className="rounded-lg bg-primary px-6 py-3 font-bold text-white transition-opacity hover:opacity-90"
                >
                    {t('table.checkout.backToMenu')}
                </button>
            </div>
        );
    }

    const canOrderToTable = payNow || payLater;
    const canSubmit =
        !!cartId &&
        cartItems.length > 0 &&
        !isSubmitting &&
        (fulfillment === 'PICKUP' ? pickupAvailable : paymentChoice !== null);

    return (
        <div className="mx-auto w-full max-w-3xl">
            <button
                onClick={() => router.push(backToMenuHref)}
                className="mb-6 flex items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-800"
            >
                <ChevronLeft size={20} />
                <span>{t('table.checkout.backToMenu')}</span>
            </button>

            <h1 className="mb-6 text-2xl font-bold text-zinc-800">{t('table.checkout.title')}</h1>

            <div className="grid gap-6">
                {/* Fulfillment */}
                <section className="overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-sm">
                    <header className="flex items-center gap-3 bg-primary p-4 text-white">
                        <Utensils size={20} />
                        <h2 className="text-lg font-bold">{t('table.checkout.fulfillmentTitle')}</h2>
                    </header>
                    <div className="grid gap-3 p-5 sm:grid-cols-2">
                        {canOrderToTable && (
                            <ChoiceCard
                                icon={Utensils}
                                title={t('table.checkout.serveToTable', { table: journey.tableLabel })}
                                description={t('table.checkout.serveToTableHint')}
                                isSelected={fulfillment === 'TABLE'}
                                onSelect={() => setFulfillment('TABLE')}
                            />
                        )}
                        {pickupAvailable && (
                            <ChoiceCard
                                icon={ShoppingBag}
                                title={t('table.checkout.pickup')}
                                description={t('table.checkout.pickupHint')}
                                isSelected={fulfillment === 'PICKUP'}
                                onSelect={() => setFulfillment('PICKUP')}
                            />
                        )}
                        {!canOrderToTable && !pickupAvailable && (
                            <p className="text-sm text-amber-600 sm:col-span-2">{t('table.panel.tableClosed')}</p>
                        )}
                    </div>
                </section>

                {/* Payment */}
                <section className="overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-sm">
                    <header className="flex items-center gap-3 bg-primary p-4 text-white">
                        <CreditCard size={20} />
                        <h2 className="text-lg font-bold">{t('table.checkout.paymentTitle')}</h2>
                    </header>
                    <div className="space-y-5 p-5">
                        {fulfillment === 'PICKUP' ? (
                            <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                                {t('table.checkout.pickupPaymentNote')}
                            </p>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {payNow && (
                                    <ChoiceCard
                                        icon={CreditCard}
                                        title={t('table.checkout.payNow')}
                                        description={t('table.checkout.payNowHint')}
                                        isSelected={paymentChoice === 'PAY_NOW'}
                                        onSelect={() => setPaymentChoice('PAY_NOW')}
                                    />
                                )}
                                {payLater && (
                                    <ChoiceCard
                                        icon={Wallet}
                                        title={t('table.checkout.payLater')}
                                        description={t('table.checkout.payLaterHint')}
                                        isSelected={paymentChoice === 'PAY_LATER'}
                                        onSelect={() => setPaymentChoice('PAY_LATER')}
                                    />
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="table-order-note" className="text-sm font-semibold text-zinc-800">
                                {t('table.checkout.noteLabel')}
                            </label>
                            <textarea
                                id="table-order-note"
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                maxLength={1000}
                                rows={3}
                                placeholder={t('table.checkout.notePlaceholder')}
                                className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                </section>

                {/* Summary */}
                <section className="overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-sm">
                    <header className="flex items-center gap-3 bg-primary p-4 text-white">
                        <ShoppingBag size={20} />
                        <h2 className="text-lg font-bold">{t('table.checkout.summaryTitle')}</h2>
                    </header>
                    <div className="p-5">
                        <div className="mb-4 border-b border-zinc-100 pb-4">
                            <p className="mb-1 text-xs text-zinc-500">{t('table.checkout.orderingFrom')}</p>
                            <p className="font-medium text-zinc-800">
                                {selectedBranch?.name || journey.tableLabel}
                            </p>
                            {fulfillment === 'TABLE' && (
                                <p className="mt-1 text-sm text-zinc-500">{journey.tableLabel}</p>
                            )}
                        </div>

                        <div className="mb-4 space-y-3">
                            {cartItems.map((item) => (
                                <div key={item.id} className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-medium text-zinc-800">
                                        {item.qty}x {item.productName}
                                    </p>
                                    <p className="text-sm font-medium text-zinc-800">
                                        {formatCurrency((item.price || 0) * item.qty)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2 border-t border-zinc-100 pt-4">
                            <div className="flex justify-between text-sm text-zinc-600">
                                <span>{t('table.checkout.subtotal')}</span>
                                <span>{formatCurrency(cartTotal)}</span>
                            </div>
                            {cart?.discountAmount && cart.discountAmount > 0 ? (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>{t('table.checkout.discount')}</span>
                                    <span>{formatCurrency(-cart.discountAmount)}</span>
                                </div>
                            ) : null}
                            <div className="flex justify-between border-t border-zinc-100 pt-2 text-lg font-bold text-zinc-800">
                                <span>{t('table.checkout.total')}</span>
                                <span>{formatCurrency(totalToPay)}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            {t('table.checkout.submitting')}
                        </>
                    ) : fulfillment === 'TABLE' && paymentChoice === 'PAY_LATER' ? (
                        <>
                            <Wallet size={20} />
                            {t('table.checkout.submitPayLater')}
                        </>
                    ) : (
                        <>
                            <CreditCard size={20} />
                            {t('table.checkout.submitPayNow')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function ChoiceCard({
    icon: Icon,
    title,
    description,
    isSelected,
    onSelect,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    description: string;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={isSelected}
            onClick={onSelect}
            className={`flex min-h-28 flex-col rounded-lg border p-4 text-left transition-colors ${isSelected
                ? 'border-primary bg-orange-50/60'
                : 'border-zinc-200 bg-white hover:border-primary/50 hover:bg-orange-50/30'
                }`}
        >
            <div className="flex items-start justify-between gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-primary text-white' : 'bg-orange-50 text-primary'}`}>
                    <Icon size={18} />
                </span>
                {isSelected && <CheckCircle size={18} className="shrink-0 text-primary" />}
            </div>
            <div className="mt-3">
                <p className="font-semibold text-zinc-800">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
            </div>
        </button>
    );
}
