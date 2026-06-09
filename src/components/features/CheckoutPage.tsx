'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useBranch } from '@/context/BranchContext';
import { paymentService, type PaymentMethod } from '@/services/payment.service';
import { branchService } from '@/services/branch.service';
import { userService } from '@/services/user.service';
import type { Address } from '@/types/address';
import { formatCurrency, sanitizePositiveNumber } from '@/lib/utils';
import { User, MapPin, ShoppingBag, CreditCard, Edit2, Mail, ChevronLeft, Plus, CheckCircle, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { AddressEditModal } from './AddressEditModal';
import { walletService, WalletBalance } from '@/services/wallet.service';
import { Wallet, Ticket, X } from 'lucide-react';

interface ApiErrorLike {
    response?: {
        data?: {
            message?: string;
        };
    };
}

interface AvailablePromotionItem {
    applicable: boolean;
    unapplicableReason?: string | null;
    promotion: {
        name: string;
        description?: string | null;
        couponCode?: string | null;
    };
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
    const apiError = error as ApiErrorLike;
    return apiError.response?.data?.message || fallback;
};

export function CheckoutPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { user, addresses, refreshAddresses, isLoading: isUserLoading } = useUser();
    const { cart, cartTotal, isLoading: isCartLoading, applyCoupon, removeCoupon } = useCart();
    const { selectedBranch } = useBranch();

    const [isProcessing, setIsProcessing] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [addressModalMode, setAddressModalMode] = useState<'new' | 'edit'>('edit');
    const [checkoutFormHtml, setCheckoutFormHtml] = useState<string | null>(null);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('ONLINE_CARD');
    const [orderNote, setOrderNote] = useState('');

    // New States
    const [couponCode, setCouponCode] = useState('');
    const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
    const [walletAmountInput, setWalletAmountInput] = useState('');
    const [walletAppliedAmount, setWalletAppliedAmount] = useState(0);
    const [isCouponLoading, setIsCouponLoading] = useState(false);
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [deliverableAddressIds, setDeliverableAddressIds] = useState<Set<string>>(new Set());
    const [isCheckingAddresses, setIsCheckingAddresses] = useState(true);
    const [isChangingAddress, setIsChangingAddress] = useState(false);

    const activeAddress = addresses.find(a => a.isActive);
    const cartItems = cart?.items || [];
    const targetBranchId = cart?.branchId || selectedBranch?.id;
    const paymentSettings = selectedBranch?.payment_settings;
    const paymentOptions = React.useMemo(() => [
        {
            value: 'ONLINE_CARD' as PaymentMethod,
            label: 'Online Card',
            description: 'Pay securely online',
            icon: CreditCard,
            isAvailable: paymentSettings?.onlineMethods?.card?.isActive ?? true,
        },
        {
            value: 'CASH' as PaymentMethod,
            label: 'Cash',
            description: 'Pay with cash on delivery',
            icon: Banknote,
            isAvailable: paymentSettings?.offlineMethods?.cash?.isActive ?? true,
        },
        {
            value: 'CARD_ON_DELIVERY' as PaymentMethod,
            label: 'Card on Delivery',
            description: 'Pay by card at the door',
            icon: Wallet,
            isAvailable: paymentSettings?.offlineMethods?.cardOnDelivery?.isActive ?? true,
        },
    ], [paymentSettings]);
    const selectedPaymentOption = paymentOptions.find(option => option.value === selectedPaymentMethod);
    const isSelectedPaymentAvailable = selectedPaymentOption?.isAvailable ?? true;
    const deliverableAddresses = React.useMemo(
        () => addresses.filter((address) => deliverableAddressIds.has(address.id)),
        [addresses, deliverableAddressIds],
    );
    const isActiveAddressDeliverable = activeAddress
        ? deliverableAddressIds.has(activeAddress.id)
        : false;

    // Redirect if not authenticated
    React.useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, isAuthLoading, router]);

    // Mark as initialized once cart has loaded
    React.useEffect(() => {
        if (!isCartLoading && !isUserLoading && isAuthenticated) {
            setHasInitialized(true);
        }
    }, [isCartLoading, isUserLoading, isAuthenticated]);

    // Redirect if no cart items (only after initialization)
    React.useEffect(() => {
        if (hasInitialized && cartItems.length === 0 && !checkoutFormHtml) {
            router.push('/');
        }
    }, [hasInitialized, cartItems.length, router, checkoutFormHtml]);

    React.useEffect(() => {
        if (isSelectedPaymentAvailable) return;

        const nextAvailablePaymentMethod = paymentOptions.find(option => option.isAvailable)?.value;
        if (nextAvailablePaymentMethod) {
            setSelectedPaymentMethod(nextAvailablePaymentMethod);
        }
    }, [isSelectedPaymentAvailable, paymentOptions]);

    // Fetch Wallet Balance
    React.useEffect(() => {
        if (isAuthenticated) {
            walletService.getBalance()
                .then(setWalletBalance)
                .catch(err => console.error('Failed to fetch wallet balance', err));
        }
    }, [isAuthenticated]);

    React.useEffect(() => {
        let isCurrent = true;

        const checkDeliverableAddresses = async () => {
            if (!targetBranchId || addresses.length === 0) {
                setDeliverableAddressIds(new Set());
                setIsCheckingAddresses(false);
                return;
            }

            setIsCheckingAddresses(true);
            try {
                const results = await Promise.all(
                    addresses.map(async (address) => {
                        if (!Number.isFinite(address.latitude) || !Number.isFinite(address.longitude)) {
                            return [address.id, false] as const;
                        }

                        try {
                            const nearbyBranches = await branchService.getNearbyBranches(address.latitude, address.longitude);
                            return [address.id, nearbyBranches.some((branch) => branch.id === targetBranchId)] as const;
                        } catch (error) {
                            console.error(`Failed to check delivery coverage for address ${address.id}`, error);
                            return [address.id, false] as const;
                        }
                    }),
                );

                if (!isCurrent) return;

                setDeliverableAddressIds(
                    new Set(results.filter(([, isDeliverable]) => isDeliverable).map(([addressId]) => addressId)),
                );
            } finally {
                if (isCurrent) {
                    setIsCheckingAddresses(false);
                }
            }
        };

        checkDeliverableAddresses();

        return () => {
            isCurrent = false;
        };
    }, [addresses, targetBranchId]);

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setIsCouponLoading(true);
        try {
            await applyCoupon(couponCode);
            setCouponCode('');
        } catch {
            // Error handled in context
        } finally {
            setIsCouponLoading(false);
        }
    };

    const handleApplySpecificCoupon = async (code: string) => {
        setIsCouponLoading(true);
        try {
            await applyCoupon(code);
            setShowCouponModal(false);
        } catch {
            // Error handled in context
        } finally {
            setIsCouponLoading(false);
        }
    };

    const handleRemoveCoupon = async () => {
        setIsCouponLoading(true);
        try {
            await removeCoupon();
        } finally {
            setIsCouponLoading(false);
        }
    };

    const handleApplyWallet = (amountOverride?: number) => {
        if (!walletBalance) return;

        let amount = amountOverride;
        if (amount === undefined) {
            if (!walletAmountInput) return;
            amount = parseFloat(walletAmountInput);
        }

        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (amount > walletBalance.balance) {
            toast.error('Amount cannot exceed wallet balance');
            return;
        }

        const totalToPay = cart?.finalPrice ?? cart?.totalCartPrice ?? 0;
        if (amount > totalToPay) {
            amount = totalToPay;
        }

        setWalletAppliedAmount(amount);
        setWalletAmountInput('');
        toast.success('Wallet applied');
    };

    const handleUseMaxWallet = () => {
        if (!walletBalance || !cart) return;
        const totalToPay = cart.finalPrice ?? cart.totalCartPrice ?? 0;
        const maxAmount = Math.min(walletBalance.balance, totalToPay);
        handleApplyWallet(maxAmount);
    };

    const handleRemoveWallet = () => {
        setWalletAppliedAmount(0);
        toast.success('Wallet removed');
    };

    const handleCheckout = async () => {
        const cartId = cart?.id || cart?.cartId;

        if (!cartId) {
            toast.error('Cart not found');
            return;
        }

        if (!activeAddress || !isActiveAddressDeliverable) {
            toast.error('Please select a delivery address served by this branch');
            return;
        }

        if (!isSelectedPaymentAvailable) {
            toast.error('Selected payment method is not available for this branch');
            return;
        }

        setIsProcessing(true);
        try {
            const response = await paymentService.initializePayment(
                cartId,
                selectedPaymentMethod,
                'DELIVERY',
                walletAppliedAmount > 0 ? walletAppliedAmount : undefined,
                orderNote.trim() || undefined,
            );

            if (response.paymentUrl) {
                // Redirect to payment URL
                window.location.href = response.paymentUrl;
            } else if (response.checkoutFormContent) {
                // iyzico returns HTML form to render
                setCheckoutFormHtml(response.checkoutFormContent);
            } else if (response.orderId || selectedPaymentMethod !== 'ONLINE_CARD') {
                const params = new URLSearchParams({
                    status: 'success',
                    paymentId: response.paymentId,
                });
                if (response.orderId) {
                    params.set('orderId', response.orderId);
                }
                router.push(`/payment/callback?${params.toString()}`);
            } else {
                toast.error('Payment initialization failed');
            }
        } catch (error: unknown) {
            console.error('Checkout error:', error);
            toast.error(getApiErrorMessage(error, 'Failed to initialize payment'));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddressUpdate = async () => {
        await refreshAddresses();
        setShowAddressModal(false);
        toast.success('Address updated successfully');
    };

    const openNewAddressModal = () => {
        setAddressModalMode('new');
        setShowAddressModal(true);
    };

    const openEditAddressModal = () => {
        setAddressModalMode('edit');
        setShowAddressModal(true);
    };

    const handleSelectAddress = async (address: Address) => {
        if (address.id === activeAddress?.id || isChangingAddress) return;

        setIsChangingAddress(true);
        try {
            await userService.setActiveAddress(address.id);
            await refreshAddresses();
            toast.success('Delivery address selected');
        } catch (error: unknown) {
            console.error('Failed to select delivery address', error);
            toast.error(getApiErrorMessage(error, 'Failed to select delivery address'));
        } finally {
            setIsChangingAddress(false);
        }
    };

    // Show loading state while data is loading
    if (!hasInitialized || isCartLoading || isUserLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-600">Loading checkout...</p>
                </div>
            </div>
        );
    }

    // If checkout form is loaded, render it
    if (checkoutFormHtml) {
        return (
            <div className="min-h-screen bg-zinc-50 py-8">
                <div className="container mx-auto px-4 max-w-2xl">
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-bold text-zinc-800 mb-4">Complete Payment</h2>
                        <div dangerouslySetInnerHTML={{ __html: checkoutFormHtml }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 py-8">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-zinc-600 hover:text-zinc-800 mb-6 transition-colors"
                >
                    <ChevronLeft size={20} />
                    <span>Back to Cart</span>
                </button>

                <h1 className="text-2xl font-bold text-zinc-800 mb-6">Checkout</h1>

                <div className="grid gap-6">
                    {/* User Info Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                        <div className="bg-primary p-4 flex items-center gap-3 text-white">
                            <User size={20} />
                            <h2 className="font-bold text-lg">Personal Information</h2>
                        </div>
                        <div className="p-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1">Full Name</p>
                                    <p className="font-medium text-zinc-800">
                                        {user?.firstName} {user?.lastName}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1">Email</p>
                                    <div className="flex items-center gap-2">
                                        <Mail size={14} className="text-zinc-400" />
                                        <p className="font-medium text-zinc-800">{user?.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Address Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                        <div className="bg-primary p-4 flex flex-col gap-3 text-white sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <MapPin size={20} />
                                <h2 className="font-bold text-lg">Delivery Address</h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={openNewAddressModal}
                                    className="flex items-center gap-1.5 text-sm font-medium border border-white/25 bg-white/12 text-white hover:bg-white/18 px-3 py-1.5 rounded-md transition-colors"
                                >
                                    <Plus size={14} />
                                    New Address
                                </button>
                                {activeAddress && (
                                    <button
                                        onClick={openEditAddressModal}
                                        className="flex items-center gap-1.5 text-sm font-medium border border-white/30 bg-white text-primary hover:bg-orange-50 px-3 py-1.5 rounded-md transition-colors"
                                    >
                                        <Edit2 size={14} />
                                        Edit
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="p-5">
                            {isCheckingAddresses ? (
                                <div className="py-4 text-sm text-zinc-500">Checking delivery addresses...</div>
                            ) : deliverableAddresses.length > 0 ? (
                                <div className="space-y-3">
                                    {deliverableAddresses.map((address) => {
                                        const isSelected = address.id === activeAddress?.id;

                                        return (
                                            <button
                                                key={address.id}
                                                type="button"
                                                aria-pressed={isSelected}
                                                disabled={isChangingAddress}
                                                onClick={() => handleSelectAddress(address)}
                                                className={`w-full text-left rounded-lg border p-4 transition-colors ${isSelected
                                                    ? 'border-primary bg-orange-50/60'
                                                    : 'border-zinc-200 bg-white hover:border-primary/50 hover:bg-orange-50/30'
                                                    } ${isChangingAddress ? 'opacity-70 cursor-wait' : ''}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-primary text-white' : 'bg-orange-50 text-primary'}`}>
                                                        <MapPin size={18} />
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="font-medium text-zinc-800 break-words">
                                                                {address.street}, {address.buildingNumber}
                                                                {address.apartmentNumber !== '-' && ` / ${address.apartmentNumber}`}
                                                            </p>
                                                            {isSelected && <CheckCircle size={18} className="shrink-0 text-primary" />}
                                                        </div>
                                                        <p className="text-sm text-zinc-600">
                                                            {address.district}, {address.province}
                                                        </p>
                                                        {address.postalCode && address.postalCode !== '00000' && (
                                                            <p className="text-sm text-zinc-500">{address.postalCode}</p>
                                                        )}
                                                        {address.phoneE164 && (
                                                            <p className="text-sm text-zinc-500">{address.phoneE164}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-zinc-500 mb-3">
                                        {addresses.length > 0
                                            ? 'No saved address is served by this branch.'
                                            : 'No delivery address found'}
                                    </p>
                                    <button
                                        onClick={openNewAddressModal}
                                        className="text-primary font-medium hover:underline"
                                    >
                                        + Add Address
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Coupons & Wallet */}
                    <div className="grid gap-6 sm:grid-cols-2">
                        {/* Coupon Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                            <div className="bg-primary p-4 flex items-center gap-3 text-white">
                                <Ticket size={20} />
                                <h2 className="font-bold text-lg">Promotions</h2>
                            </div>
                            <div className="p-5">
                                {cart?.appliedPromotion ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between bg-green-50 text-green-700 p-3 rounded-lg border border-green-200">
                                            <div className="flex items-center gap-2">
                                                <Ticket size={16} />
                                                <div>
                                                    <p className="font-bold text-sm">{cart.appliedPromotion.name}</p>
                                                    <p className="text-xs">{cart.appliedPromotion.description}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleRemoveCoupon}
                                                disabled={isCouponLoading}
                                                className="text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 p-1.5 rounded-full transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setShowCouponModal(true)}
                                            className="w-full text-center text-primary text-sm hover:underline"
                                        >
                                            View Available Coupons
                                        </button>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value)}
                                                placeholder="Enter coupon code"
                                                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase placeholder:normal-case"
                                            />
                                            <button
                                                onClick={handleApplyCoupon}
                                                disabled={!couponCode.trim() || isCouponLoading}
                                                className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => setShowCouponModal(true)}
                                            className="w-full text-center text-primary text-sm hover:underline"
                                        >
                                            View Available Coupons
                                        </button>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value)}
                                                placeholder="Enter coupon code"
                                                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase placeholder:normal-case"
                                            />
                                            <button
                                                onClick={handleApplyCoupon}
                                                disabled={!couponCode.trim() || isCouponLoading}
                                                className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Wallet Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                            <div className="bg-primary p-4 flex items-center gap-3 text-white">
                                <Wallet size={20} />
                                <h2 className="font-bold text-lg">Wallet</h2>
                            </div>
                            <div className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-zinc-600 text-sm">Review Wallet Balance</span>
                                    <span className="font-bold text-zinc-800">
                                        {formatCurrency(walletBalance?.balance)}
                                    </span>
                                </div>

                                {walletAppliedAmount > 0 ? (
                                    <div className="flex items-center justify-between bg-green-50 text-green-700 p-3 rounded-lg border border-green-200">
                                        <span className="font-medium text-sm">Used: {formatCurrency(walletAppliedAmount)}</span>
                                        <button
                                            onClick={handleRemoveWallet}
                                            className="text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 p-1.5 rounded-full transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            inputMode="decimal"
                                            value={walletAmountInput}
                                            onChange={(e) => setWalletAmountInput(sanitizePositiveNumber(e.target.value, walletAmountInput))}
                                            placeholder="Amount to use"
                                            className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                            onClick={() => handleApplyWallet()}
                                            disabled={!walletBalance || walletBalance.balance <= 0 || !walletAmountInput}
                                            className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            onClick={handleUseMaxWallet}
                                            disabled={!walletBalance || walletBalance.balance <= 0}
                                            className="bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                        >
                                            Use All
                                        </button>
                                    </div>
                                )}

                                {walletAppliedAmount > 0 && (
                                    <p className="text-xs text-green-600 mt-2 text-right">
                                        {formatCurrency(-walletAppliedAmount)} applied
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Payment Method & Order Note */}
                    <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                        <div className="bg-primary p-4 flex items-center gap-3 text-white">
                            <CreditCard size={20} />
                            <h2 className="font-bold text-lg">Payment</h2>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="grid gap-3 sm:grid-cols-3">
                                {paymentOptions.map((option) => {
                                    const Icon = option.icon;
                                    const isSelected = selectedPaymentMethod === option.value;

                                    return (
                                        <label
                                            key={option.value}
                                            className={`flex min-h-28 cursor-pointer flex-col rounded-lg border p-4 transition-colors ${isSelected
                                                ? 'border-primary bg-orange-50/60'
                                                : 'border-zinc-200 bg-white hover:border-primary/50 hover:bg-orange-50/30'
                                                } ${!option.isAvailable ? 'cursor-not-allowed opacity-50' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="paymentMethod"
                                                value={option.value}
                                                checked={isSelected}
                                                disabled={!option.isAvailable}
                                                onChange={() => setSelectedPaymentMethod(option.value)}
                                                className="sr-only"
                                            />
                                            <div className="flex items-start justify-between gap-3">
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-primary text-white' : 'bg-orange-50 text-primary'}`}>
                                                    <Icon size={18} />
                                                </span>
                                                {isSelected && <CheckCircle size={18} className="shrink-0 text-primary" />}
                                            </div>
                                            <div className="mt-3">
                                                <p className="font-semibold text-zinc-800">{option.label}</p>
                                                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                                                    {option.isAvailable ? option.description : 'Not available for this branch'}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="order-note" className="text-sm font-semibold text-zinc-800">
                                    Order Note
                                </label>
                                <textarea
                                    id="order-note"
                                    value={orderNote}
                                    onChange={(event) => setOrderNote(event.target.value)}
                                    maxLength={1000}
                                    rows={3}
                                    placeholder="Add a note for this order"
                                    className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cart Summary Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                        <div className="bg-primary p-4 flex items-center gap-3 text-white">
                            <ShoppingBag size={20} />
                            <h2 className="font-bold text-lg">Order Summary</h2>
                        </div>
                        <div className="p-5">
                            {/* Branch Info */}
                            {selectedBranch && (
                                <div className="mb-4 pb-4 border-b border-zinc-100">
                                    <p className="text-xs text-zinc-500 mb-1">Ordering from</p>
                                    <p className="font-medium text-zinc-800">{selectedBranch.name}</p>
                                </div>
                            )}

                            {/* Cart Items */}
                            <div className="space-y-3 mb-4">
                                {cartItems.map((item) => (
                                    <div key={item.id} className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="font-medium text-zinc-800 text-sm">
                                                {item.qty}x {item.productName}
                                            </p>
                                            {/* Options */}
                                            {(item.options ?? []).length > 0 && (
                                                <div className="text-xs text-zinc-500 mt-0.5">
                                                    {(item.options ?? []).map((group, idx: number) => (
                                                        <span key={idx}>
                                                            {group.selections?.map((sel) => sel.optionName).join(', ')}
                                                            {idx < (item.options?.length ?? 0) - 1 && ' • '}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {item.note && (
                                                <p className="mt-0.5 text-xs text-zinc-500 break-words">
                                                    <span className="font-medium">Note:</span> {item.note}
                                                </p>
                                            )}
                                        </div>
                                        <p className="font-medium text-zinc-800 text-sm">
                                            {formatCurrency((item.price || 0) * item.qty)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-zinc-100 pt-4 space-y-2">
                                <div className="flex justify-between text-sm text-zinc-600">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(cartTotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-zinc-600">
                                    <span>Delivery Fee</span>
                                    <span className="text-green-600">Free</span>
                                </div>

                                {cart?.discountAmount && cart.discountAmount > 0 ? (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <div className="flex items-center gap-1">
                                            <Ticket size={14} />
                                            <span>Discount</span>
                                        </div>
                                        <span>{formatCurrency(-cart.discountAmount)}</span>
                                    </div>
                                ) : null}

                                {walletAppliedAmount > 0 ? (
                                    <div className="flex justify-between text-sm text-primary">
                                        <div className="flex items-center gap-1">
                                            <Wallet size={14} />
                                            <span>Wallet Used</span>
                                        </div>
                                        <span>{formatCurrency(-walletAppliedAmount)}</span>
                                    </div>
                                ) : null}

                                <div className="flex justify-between text-lg font-bold text-zinc-800 pt-2 border-t border-zinc-100">
                                    <span>Total</span>
                                    <span>{formatCurrency(Math.max(0, (cart?.finalPrice ?? cart?.totalCartPrice ?? cartTotal) - walletAppliedAmount))}</span>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Checkout Button */}
                    <button
                        onClick={handleCheckout}
                        disabled={isProcessing || isCheckingAddresses || !activeAddress || !isActiveAddressDeliverable || !isSelectedPaymentAvailable}
                        className="w-full bg-primary text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                {selectedPaymentMethod === 'CASH' ? <Banknote size={20} /> : <CreditCard size={20} />}
                                {selectedPaymentMethod === 'ONLINE_CARD' ? 'Proceed to Payment' : 'Place Order'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Address Edit Modal */}
            {showAddressModal && (
                <AddressEditModal
                    address={addressModalMode === 'edit' ? activeAddress : undefined}
                    onClose={() => setShowAddressModal(false)}
                    onSave={handleAddressUpdate}
                />
            )}

            {/* Coupon List Modal */}
            {showCouponModal && (
                <CouponListModal
                    onClose={() => setShowCouponModal(false)}
                    onApply={handleApplySpecificCoupon}
                />
            )}
        </div>
    );
}

function CouponListModal({ onClose, onApply }: { onClose: () => void; onApply: (code: string) => void }) {
    const { availablePromotions, checkAvailablePromotions } = useCart();
    const promotionItems = availablePromotions as AvailablePromotionItem[];

    React.useEffect(() => {
        checkAvailablePromotions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-bold text-lg">Available Coupons</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {promotionItems.length === 0 ? (
                        <p className="text-center text-zinc-500 py-4">No available coupons found.</p>
                    ) : (
                        <div className="space-y-3">
                            {promotionItems.map((item, idx: number) => (
                                <div key={idx} className={`p-4 rounded-lg border ${item.applicable ? 'border-green-200 bg-green-50' : 'border-zinc-200 bg-zinc-50 opacity-70'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-zinc-800">{item.promotion.name}</h4>
                                        {item.applicable && (
                                            <button
                                                onClick={() => item.promotion.couponCode && onApply(item.promotion.couponCode)}
                                                disabled={!item.promotion.couponCode}
                                                className="text-xs bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Apply
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-zinc-600 mb-2">{item.promotion.description}</p>
                                    {item.applicable && !item.promotion.couponCode && (
                                        <p className="text-xs text-amber-600">
                                            This promotion has no coupon code configured.
                                        </p>
                                    )}
                                    {!item.applicable && (
                                        <p className="text-xs text-red-500">
                                            {item.unapplicableReason === 'ALREADY_USED'
                                                ? 'This coupon has already been used'
                                                : item.unapplicableReason}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
