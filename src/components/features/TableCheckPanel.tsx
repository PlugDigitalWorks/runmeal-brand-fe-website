'use client';

import React from 'react';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Clock3,
    CreditCard,
    Minus,
    Plus,
    ReceiptText,
    RefreshCw,
    Split,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { rememberTableCheckPayment, type PendingTableCheckPayment } from '@/lib/table-check-payment';
import { tableService } from '@/services/table.service';
import type {
    CustomerTableCheck,
    QrOrderContext,
    TableCheckPaymentInitialization,
    TableSplitPart,
} from '@/types/table';

type SelectionMap = Record<string, number>;

interface ApiErrorLike {
    response?: { status?: number; data?: { code?: string; message?: string } };
}

const REFRESH_ERROR_CODES = new Set([
    'CHECK_ITEMS_UNAVAILABLE',
    'CHECK_PAYMENT_IN_PROGRESS',
    'SPLIT_PLAN_ACTIVE',
    'SPLIT_PLAN_ALREADY_STARTED',
    'SPLIT_PART_RESERVED',
    'SPLIT_PART_ALREADY_PAID',
    'SPLIT_PLAN_BALANCE_CHANGED',
]);

function getError(error: unknown) {
    const response = (error as ApiErrorLike)?.response;
    return {
        status: response?.status,
        code: response?.data?.code,
        message: response?.data?.message,
    };
}

/** Renders provider HTML using the same handoff used by ordinary checkout. */
function CheckoutForm({ html, onClose }: { html: string; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <section className="mb-6 overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 p-4">
                <h2 className="font-bold text-zinc-800">{t('table.check.completePayment')}</h2>
                <button onClick={onClose} className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
                    {t('table.check.cancel')}
                </button>
            </div>
            <div className="p-5" dangerouslySetInnerHTML={{ __html: html }} />
        </section>
    );
}

export function TableCheckPanel({
    journey,
    sessionReady,
}: {
    journey: QrOrderContext;
    sessionReady: boolean;
}) {
    const { t } = useTranslation();
    const [check, setCheck] = React.useState<CustomerTableCheck | null>(null);
    const [selection, setSelection] = React.useState<SelectionMap>({});
    const [partCount, setPartCount] = React.useState(2);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(true);
    const [checkoutForm, setCheckoutForm] = React.useState<string | null>(null);
    const [clock, setClock] = React.useState(() => Date.now());

    const loadCheck = React.useCallback(async (quiet = false) => {
        if (!sessionReady) return null;
        if (!quiet) setIsLoading(true);
        try {
            const current = await tableService.getCurrentCheck(journey.qrToken);
            setCheck(current);
            return current;
        } catch (error) {
            if (getError(error).status === 404) {
                setCheck(null);
                return null;
            }
            console.error('Failed to load the shared table check', error);
            if (!quiet) toast.error(t('table.check.errors.load'));
            return null;
        } finally {
            if (!quiet) setIsLoading(false);
        }
    }, [journey.qrToken, sessionReady, t]);

    React.useEffect(() => {
        setCheck(null);
        setSelection({});
        setCheckoutForm(null);
        if (sessionReady) void loadCheck();
    }, [journey.qrToken, sessionReady, loadCheck]);

    // A refreshed response is authoritative. Keep valid quantities and only
    // trim selections after that response says availability changed.
    React.useEffect(() => {
        if (!check) return;
        const availability = new Map(
            check.orders.flatMap((order) =>
                order.items.map((item) => [item.orderItemId, item.availableQuantity] as const),
            ),
        );
        setSelection((current) => Object.fromEntries(
            Object.entries(current)
                .map(([id, quantity]) => [id, Math.min(quantity, availability.get(id) ?? 0)] as const)
                .filter(([, quantity]) => quantity > 0),
        ));
    }, [check]);

    const nextReservationExpiry = check?.splitPlan?.parts
        .filter((part) => part.status === 'RESERVED' && part.reservationExpiresAt)
        .map((part) => new Date(part.reservationExpiresAt!).getTime())
        .filter((time) => time > Date.now())
        .sort((a, b) => a - b)[0];

    React.useEffect(() => {
        if (!nextReservationExpiry) return;
        const delay = Math.max(0, nextReservationExpiry - Date.now()) + 500;
        const timeout = window.setTimeout(() => void loadCheck(true), delay);
        const interval = window.setInterval(() => setClock(Date.now()), 1000);
        return () => {
            window.clearTimeout(timeout);
            window.clearInterval(interval);
        };
    }, [nextReservationExpiry, loadCheck]);

    const handleFailure = async (error: unknown) => {
        const apiError = getError(error);
        const key = apiError.code ? `table.check.errors.${apiError.code}` : '';
        const localized = key ? t(key) : '';
        toast.error(localized && localized !== key ? localized : apiError.message || t('table.check.errors.generic'));
        if (apiError.status === 409 || (apiError.code && REFRESH_ERROR_CODES.has(apiError.code))) {
            await loadCheck(true);
        }
    };

    const openCheckout = (
        payment: TableCheckPaymentInitialization,
        confirmation: PendingTableCheckPayment['confirmation'],
    ) => {
        rememberTableCheckPayment(journey.qrToken, payment, confirmation, check?.remainingAmount ?? 0);
        if (payment.paymentUrl) {
            window.location.assign(payment.paymentUrl);
        } else if (payment.checkoutFormContent) {
            setCheckoutForm(payment.checkoutFormContent);
        } else {
            toast.error(t('table.check.errors.paymentMissing'));
        }
    };

    const selectedItems = Object.entries(selection)
        .filter(([, quantity]) => quantity > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    const paySelected = async () => {
        if (!selectedItems.length || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const paidQuantities = new Map(
                check?.orders.flatMap((order) =>
                    order.items.map((item) => [item.orderItemId, item.paidQuantity] as const),
                ) ?? [],
            );
            openCheckout(
                await tableService.initializeItemPayment(journey.qrToken, selectedItems),
                {
                    mode: 'ITEMS',
                    items: selectedItems.map(({ orderItemId, quantity }) => ({
                        orderItemId,
                        paidQuantity: (paidQuantities.get(orderItemId) ?? 0) + quantity,
                    })),
                },
            );
        } catch (error) {
            await handleFailure(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const createSplit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await tableService.createSplitPlan(journey.qrToken, partCount);
            await loadCheck(true);
        } catch (error) {
            await handleFailure(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const payPart = async (part: TableSplitPart) => {
        if (!check?.splitPlan || part.status !== 'AVAILABLE' || isSubmitting) return;
        setIsSubmitting(true);
        try {
            openCheckout(
                await tableService.initializeSplitPayment(
                    journey.qrToken,
                    check.splitPlan.splitPlanId,
                    part.partNumber,
                ),
                {
                    mode: 'EQUAL_SPLIT',
                    splitPlanId: check.splitPlan.splitPlanId,
                    partNumber: part.partNumber,
                },
            );
        } catch (error) {
            await handleFailure(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const cancelSplit = async () => {
        if (!check?.splitPlan || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await tableService.cancelSplitPlan(journey.qrToken, check.splitPlan.splitPlanId);
            await loadCheck(true);
        } catch (error) {
            await handleFailure(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const setItemQuantity = (id: string, value: number, maximum: number) => {
        const quantity = Math.max(0, Math.min(value, maximum));
        setSelection((current) => {
            if (!quantity) {
                const next = { ...current };
                delete next[id];
                return next;
            }
            return { ...current, [id]: quantity };
        });
    };

    if (!sessionReady || (isLoading && !check)) {
        return (
            <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-zinc-100 bg-white p-5 text-sm text-zinc-500 shadow-sm">
                <RefreshCw size={16} className="animate-spin" />
                {t('table.check.loading')}
            </div>
        );
    }

    // A freshly scanned table legitimately has no visit yet. The menu remains
    // the primary UI until its first order opens a check.
    if (!check) return null;
    if (checkoutForm) return <CheckoutForm html={checkoutForm} onClose={() => setCheckoutForm(null)} />;

    const splitStarted = !!check.splitPlan?.parts.some((part) => part.status !== 'AVAILABLE');

    return (
        <section className="mb-6 overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setIsExpanded((value) => !value)}
                className="flex w-full items-center justify-between gap-3 p-5 text-left"
                aria-expanded={isExpanded}
            >
                <span className="flex items-center gap-3">
                    <span className="rounded-full bg-orange-50 p-2 text-primary"><ReceiptText size={20} /></span>
                    <span>
                        <span className="block font-bold text-zinc-800">{t('table.check.title')}</span>
                        <span className="text-sm text-zinc-500">
                            {t('table.check.remainingSummary', { amount: formatCurrency(check.remainingAmount) })}
                        </span>
                    </span>
                </span>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {isExpanded && (
                <div className="border-t border-zinc-100 p-5">
                    <div className="mb-5 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-center">
                        <Amount label={t('table.check.total')} value={check.totalAmount} />
                        <Amount label={t('table.check.paid')} value={check.paidAmount} />
                        <Amount label={t('table.check.remaining')} value={check.remainingAmount} strong />
                    </div>

                    {check.splitPlan ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="flex items-center gap-2 font-semibold text-zinc-800">
                                    <Split size={17} />
                                    {t('table.check.splitTitle', { count: check.splitPlan.partCount })}
                                </h3>
                                {!splitStarted && (
                                    <button
                                        onClick={cancelSplit}
                                        disabled={isSubmitting}
                                        className="text-sm font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50"
                                    >
                                        {t('table.check.cancelSplit')}
                                    </button>
                                )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {check.splitPlan.parts.map((part) => (
                                    <SplitPartCard
                                        key={part.partNumber}
                                        part={part}
                                        clock={clock}
                                        disabled={!check.checkoutOptions.payNow || isSubmitting}
                                        onPay={() => void payPart(part)}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                {check.orders.map((order, orderIndex) => (
                                    <div key={order.orderId} className="rounded-lg border border-zinc-100 p-4">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-zinc-700">
                                                {t('table.check.order', { number: orderIndex + 1 })}
                                            </p>
                                            {order.isOwnOrder && (
                                                <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                                    {t('table.check.yourOrder')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {order.items.map((item) => {
                                                const quantity = selection[item.orderItemId] ?? 0;
                                                return (
                                                    <div key={item.orderItemId} className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 first:border-0 first:pt-0">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium text-zinc-800">{item.productName}</p>
                                                            <p className="text-xs text-zinc-500">
                                                                {t('table.check.itemAvailability', {
                                                                    available: item.availableQuantity,
                                                                    total: item.quantity,
                                                                })}
                                                                {' · '}{formatCurrency(item.remainingAmount)}
                                                            </p>
                                                        </div>
                                                        {check.checkoutOptions.payNow && check.remainingAmount > 0 && (
                                                            <QuantityPicker
                                                                value={quantity}
                                                                maximum={item.availableQuantity}
                                                                onChange={(value) => setItemQuantity(item.orderItemId, value, item.availableQuantity)}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {check.checkoutOptions.payNow && check.remainingAmount > 0 && (
                                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                                    <button
                                        onClick={() => void paySelected()}
                                        disabled={!selectedItems.length || isSubmitting}
                                        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <CreditCard size={18} />
                                        {isSubmitting ? t('table.check.startingPayment') : t('table.check.paySelected')}
                                    </button>
                                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2">
                                        <label htmlFor="split-part-count" className="pl-1 text-sm text-zinc-600">
                                            {t('table.check.splitInto')}
                                        </label>
                                        <input
                                            id="split-part-count"
                                            type="number"
                                            min={2}
                                            max={20}
                                            value={partCount}
                                            onChange={(event) => setPartCount(Math.max(2, Math.min(20, Number(event.target.value) || 2)))}
                                            className="w-14 rounded border border-zinc-200 px-2 py-1 text-center text-sm"
                                        />
                                        <button
                                            onClick={() => void createSplit()}
                                            disabled={isSubmitting}
                                            className="rounded bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                                        >
                                            {t('table.check.splitAction')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <button
                        onClick={() => void loadCheck()}
                        disabled={isLoading || isSubmitting}
                        className="mt-4 flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                        {t('table.check.refresh')}
                    </button>
                </div>
            )}
        </section>
    );
}

function Amount({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
    return (
        <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={strong ? 'text-sm font-bold text-primary' : 'text-sm font-semibold text-zinc-800'}>
                {formatCurrency(value)}
            </p>
        </div>
    );
}

function QuantityPicker({
    value,
    maximum,
    onChange,
}: {
    value: number;
    maximum: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 p-1">
            <button
                type="button"
                aria-label="Decrease"
                onClick={() => onChange(value - 1)}
                disabled={value === 0}
                className="rounded p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
            >
                <Minus size={14} />
            </button>
            <span className="w-5 text-center text-sm font-semibold">{value}</span>
            <button
                type="button"
                aria-label="Increase"
                onClick={() => onChange(value + 1)}
                disabled={value >= maximum}
                className="rounded p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
            >
                <Plus size={14} />
            </button>
        </div>
    );
}

function SplitPartCard({
    part,
    clock,
    disabled,
    onPay,
}: {
    part: TableSplitPart;
    clock: number;
    disabled: boolean;
    onPay: () => void;
}) {
    const { t } = useTranslation();
    const seconds = part.reservationExpiresAt
        ? Math.max(0, Math.ceil((new Date(part.reservationExpiresAt).getTime() - clock) / 1000))
        : 0;
    const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 p-4">
            <div>
                <p className="text-xs text-zinc-500">{t('table.check.part', { number: part.partNumber })}</p>
                <p className="font-bold text-zinc-800">{formatCurrency(part.amount)}</p>
            </div>
            {part.status === 'AVAILABLE' ? (
                <button
                    onClick={onPay}
                    disabled={disabled}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                    {t('table.check.payPart')}
                </button>
            ) : part.status === 'PAID' ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                    <Check size={15} /> {t('table.check.partPaid')}
                </span>
            ) : (
                <span className="text-right text-xs font-medium text-amber-600">
                    <span className="flex items-center justify-end gap-1"><Clock3 size={13} /> {countdown}</span>
                    {part.isOwnReservation ? t('table.check.reservedByYou') : t('table.check.reserved')}
                </span>
            )}
        </div>
    );
}
