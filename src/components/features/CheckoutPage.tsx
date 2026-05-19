'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useBranch } from '@/context/BranchContext';
import { paymentService } from '@/services/payment.service';
import { User, MapPin, ShoppingBag, CreditCard, Edit2, Phone, Mail, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { AddressEditModal } from './AddressEditModal';
import { walletService, WalletBalance } from '@/services/wallet.service';
import { Wallet, Ticket, X } from 'lucide-react';

export function CheckoutPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { user, addresses, refreshAddresses, isLoading: isUserLoading } = useUser();
    const { cart, cartTotal, isLoading: isCartLoading, applyCoupon, removeCoupon } = useCart();
    const { selectedBranch } = useBranch();

    const [isProcessing, setIsProcessing] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [checkoutFormHtml, setCheckoutFormHtml] = useState<string | null>(null);
    const [hasInitialized, setHasInitialized] = useState(false);

    // New States
    const [couponCode, setCouponCode] = useState('');
    const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
    const [walletAmountInput, setWalletAmountInput] = useState('');
    const [walletAppliedAmount, setWalletAppliedAmount] = useState(0);
    const [isCouponLoading, setIsCouponLoading] = useState(false);
    const [showCouponModal, setShowCouponModal] = useState(false);

    const activeAddress = addresses.find(a => a.isActive);
    const cartItems = cart?.items || [];

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

    // Fetch Wallet Balance
    React.useEffect(() => {
        if (isAuthenticated) {
            walletService.getBalance()
                .then(setWalletBalance)
                .catch(err => console.error('Failed to fetch wallet balance', err));
        }
    }, [isAuthenticated]);

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setIsCouponLoading(true);
        try {
            await applyCoupon(couponCode);
            setCouponCode('');
        } catch (error) {
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
        } catch (error) {
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

        if (!activeAddress) {
            toast.error('Please add a delivery address');
            return;
        }

        setIsProcessing(true);
        try {
            const response = await paymentService.initializePayment(cartId, 'ONLINE_CARD', 'DELIVERY', walletAppliedAmount > 0 ? walletAppliedAmount : undefined);

            if (response.paymentUrl) {
                // Redirect to payment URL
                window.location.href = response.paymentUrl;
            } else if (response.checkoutFormContent) {
                // iyzico returns HTML form to render
                setCheckoutFormHtml(response.checkoutFormContent);
            } else {
                toast.error('Payment initialization failed');
            }
        } catch (error: any) {
            console.error('Checkout error:', error);
            toast.error(error.response?.data?.message || 'Failed to initialize payment');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddressUpdate = async () => {
        await refreshAddresses();
        setShowAddressModal(false);
        toast.success('Address updated successfully');
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
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1">Phone Number</p>
                                    <div className="flex items-center gap-2">
                                        <Phone size={14} className="text-zinc-400" />
                                        <p className="font-medium text-zinc-800">
                                            {user?.phoneNumber || <span className="text-zinc-400 italic">Not provided</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Address Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
                        <div className="bg-primary p-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-3">
                                <MapPin size={20} />
                                <h2 className="font-bold text-lg">Delivery Address</h2>
                            </div>
                            {activeAddress && (
                                <button
                                    onClick={() => setShowAddressModal(true)}
                                    className="flex items-center gap-1 text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
                                >
                                    <Edit2 size={14} />
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="p-5">
                            {activeAddress ? (
                                <div className="space-y-2">
                                    <p className="font-medium text-zinc-800">
                                        {activeAddress.street}, {activeAddress.buildingNumber}
                                        {activeAddress.apartmentNumber !== '-' && ` / ${activeAddress.apartmentNumber}`}
                                    </p>
                                    <p className="text-sm text-zinc-600">
                                        {activeAddress.district}, {activeAddress.province}
                                    </p>
                                    {activeAddress.postalCode && activeAddress.postalCode !== '00000' && (
                                        <p className="text-sm text-zinc-500">{activeAddress.postalCode}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-zinc-500 mb-3">No delivery address found</p>
                                    <button
                                        onClick={() => setShowAddressModal(true)}
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
                                        {walletBalance?.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                    </span>
                                </div>

                                {walletAppliedAmount > 0 ? (
                                    <div className="flex items-center justify-between bg-green-50 text-green-700 p-3 rounded-lg border border-green-200">
                                        <span className="font-medium text-sm">Used: {walletAppliedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
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
                                            value={walletAmountInput}
                                            onChange={(e) => setWalletAmountInput(e.target.value)}
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
                                        -{walletAppliedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL applied
                                    </p>
                                )}
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
                                {cartItems.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="font-medium text-zinc-800 text-sm">
                                                {item.qty || item.quantity}x {item.productName || item.name}
                                            </p>
                                            {/* Options */}
                                            {item.options && item.options.length > 0 && (
                                                <div className="text-xs text-zinc-500 mt-0.5">
                                                    {item.options.map((group: any, idx: number) => (
                                                        <span key={idx}>
                                                            {group.selections?.map((sel: any) => sel.optionName).join(', ')}
                                                            {idx < item.options.length - 1 && ' • '}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p className="font-medium text-zinc-800 text-sm">
                                            {((item.price || 0) * (item.qty || item.quantity)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-zinc-100 pt-4 space-y-2">
                                <div className="flex justify-between text-sm text-zinc-600">
                                    <span>Subtotal</span>
                                    <span>{cartTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
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
                                        <span>-{cart.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                                    </div>
                                ) : null}

                                {walletAppliedAmount > 0 ? (
                                    <div className="flex justify-between text-sm text-primary">
                                        <div className="flex items-center gap-1">
                                            <Wallet size={14} />
                                            <span>Wallet Used</span>
                                        </div>
                                        <span>-{walletAppliedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                                    </div>
                                ) : null}

                                <div className="flex justify-between text-lg font-bold text-zinc-800 pt-2 border-t border-zinc-100">
                                    <span>Total</span>
                                    <span>{Math.max(0, (cart?.finalPrice ?? cart?.totalCartPrice ?? cartTotal) - walletAppliedAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Checkout Button */}
                    <button
                        onClick={handleCheckout}
                        disabled={isProcessing || !activeAddress}
                        className="w-full bg-primary text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CreditCard size={20} />
                                Proceed to Payment
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Address Edit Modal */}
            {showAddressModal && (
                <AddressEditModal
                    address={activeAddress}
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

    React.useEffect(() => {
        checkAvailablePromotions();
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
                    {availablePromotions.length === 0 ? (
                        <p className="text-center text-zinc-500 py-4">No available coupons found.</p>
                    ) : (
                        <div className="space-y-3">
                            {availablePromotions.map((item: any, idx: number) => (
                                <div key={idx} className={`p-4 rounded-lg border ${item.applicable ? 'border-green-200 bg-green-50' : 'border-zinc-200 bg-zinc-50 opacity-70'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-zinc-800">{item.promotion.name}</h4>
                                        {item.applicable && (
                                            <button
                                                onClick={() => onApply(item.promotion.couponCode)}
                                                className="text-xs bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700"
                                            >
                                                Apply
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-zinc-600 mb-2">{item.promotion.description}</p>
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
