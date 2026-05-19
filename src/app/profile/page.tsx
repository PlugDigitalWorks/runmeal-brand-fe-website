'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Plus, Trash2, X, Edit2, ChevronDown, Package, User as UserIcon, Mail, Shield } from 'lucide-react';
import { useEffect, useState, Suspense } from 'react';
import { useUser } from '@/context/UserContext';
import { Address } from '@/types/address';
import { userService } from '@/services/user.service';
import { AddressForm } from '@/components/features/address/AddressForm';
import { orderService } from '@/services/order.service';
import { Order, OrderDetails } from '@/services/order.service';
import { toast } from 'sonner';

function ProfileContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, addresses, refreshAddresses, isLoading: isContextLoading } = useUser();
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState<'addresses' | 'orders'>('addresses');
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [orderDetails, setOrderDetails] = useState<Record<string, OrderDetails>>({});
    const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (user) {
            orderService.getMyOrders().then(setOrders).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'orders' || tab === 'addresses') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        if (searchParams.get('action') === 'new' && !isAddingAddress) {
            // Build valid URL without the query param to prevent loop/re-trigger if needed, or just set state
            setTimeout(() => setIsAddingAddress(true), 0);
        }
    }, [searchParams, isAddingAddress]);

    const onEditClick = (addr: Address) => {
        setEditingId(addr.id);
        setIsAddingAddress(true);
    };

    const onCancelEdit = () => {
        setIsAddingAddress(false);
        setEditingId(null);
    };

    const handleSuccess = async () => {
        await refreshAddresses();
        setIsAddingAddress(false);
        setEditingId(null);
        toast.success('Address saved successfully');
    };

    const onDeleteAddress = async (id: string) => {
        if (!confirm('Are you sure you want to delete this address?')) return;
        try {
            await userService.deleteAddress(id);
            await refreshAddresses();
            toast.success('Address deleted');
        } catch (error) {
            console.error('Failed to delete', error);
            toast.error('Failed to delete address');
        }
    }

    const toggleOrder = async (orderId: string) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
            setExpandedOrders(newExpanded);
            return;
        }

        newExpanded.add(orderId);
        setExpandedOrders(newExpanded);

        if (!orderDetails[orderId]) {
            const order = orders.find(o => o.id === orderId);
            if (!order) return;

            setLoadingDetails(prev => new Set(prev).add(orderId));
            try {
                const details = await orderService.getOrderById(orderId, order.branchId, order.brandId);
                setOrderDetails(prev => ({ ...prev, [orderId]: details }));
            } catch (error) {
                console.error('Failed to fetch order details', error);
                toast.error('Failed to load order details');
            } finally {
                setLoadingDetails(prev => {
                    const next = new Set(prev);
                    next.delete(orderId);
                    return next;
                });
            }
        }
    };

    if (isContextLoading && !user) {
        return <div className="min-h-screen flex items-center justify-center pt-20">Loading...</div>;
    }

    if (!user && !isContextLoading) {
        router.push('/login');
        return null;
    }

    if (!user) return null;

    // Find the address object if we are editing
    const editingAddress = editingId ? addresses.find(a => a.id === editingId) : undefined;

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <h1 className="text-3xl font-bold text-zinc-900 mb-8">Account Settings</h1>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    {/* Profile Card */}
                    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                                <UserIcon className="w-4 h-4" /> Personal Info
                            </h3>
                            <p className="text-sm text-zinc-500 mt-1">Your account details</p>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                    Name
                                </label>
                                <div className="font-medium text-zinc-900 bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-100">
                                    {user?.firstName} {user?.lastName}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> Email
                                </label>
                                <div className="font-medium text-zinc-900 break-all bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-100">
                                    {user?.email}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> Role
                                </label>
                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium capitalize">
                                    {user?.role}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex space-x-1 bg-zinc-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('addresses')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'addresses' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50'}`}
                        >
                            Addresses
                        </button>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'orders' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50'}`}
                        >
                            Orders
                        </button>
                    </div>

                    {activeTab === 'orders' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                                    <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                                        <Package className="w-4 h-4" /> Order History
                                    </h3>
                                </div>
                                <div className="p-0">
                                    {orders.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Package className="w-8 h-8 text-zinc-300" />
                                            </div>
                                            <p className="text-zinc-500">No orders yet.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-zinc-100">
                                            {orders.map(order => (
                                                <div key={order.id} className="transition-colors hover:bg-zinc-50/50">
                                                    <div
                                                        className="flex justify-between items-center p-4 cursor-pointer"
                                                        onClick={() => toggleOrder(order.id)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-2 rounded-full bg-zinc-100 text-zinc-500 transition-transform duration-200 ${expandedOrders.has(order.id) ? 'rotate-180' : ''}`}>
                                                                <ChevronDown className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-zinc-900">
                                                                    {new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                                <div className="text-xs text-zinc-500 mt-0.5">
                                                                    Order #{order.id.slice(-8)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-zinc-900">
                                                                ₺{Number(order.totalPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                            </div>
                                                            <div className={`text-xs px-2.5 py-0.5 rounded-full inline-block capitalize mt-1.5 font-medium
                                                        ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                {order.status}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {expandedOrders.has(order.id) && (
                                                        <div className="px-4 pb-4 pl-[4.5rem]">
                                                            <div className="bg-zinc-50 rounded-lg p-4 space-y-3 border border-zinc-200/50">
                                                                {loadingDetails.has(order.id) ? (
                                                                    <div className="text-sm text-zinc-500 py-2 flex items-center gap-2">
                                                                        <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin"></div>
                                                                        Loading details...
                                                                    </div>
                                                                ) : orderDetails[order.id] ? (
                                                                    <div className="space-y-2">
                                                                        {orderDetails[order.id].items.map((item) => (
                                                                            <div key={item.id} className="flex justify-between text-sm">
                                                                                <div className="text-zinc-600 flex items-center gap-2">
                                                                                    <span className="font-semibold text-zinc-900 bg-white border border-zinc-200 px-1.5 rounded text-xs min-w-[1.5rem] text-center">{item.quantity || 1}x</span>
                                                                                    <span>{item.productName}</span>
                                                                                </div>
                                                                                <div className="text-zinc-900 font-medium whitespace-nowrap">
                                                                                    ₺{Number(item.totalPrice || item.price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                        <div className="border-t border-zinc-200 mt-3 pt-3 flex justify-between items-center">
                                                                            <span className="text-sm font-medium text-zinc-900">Total</span>
                                                                            <span className="text-base font-bold text-primary">₺{Number(orderDetails[order.id].totalPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-red-500">Failed to load details</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'addresses' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-zinc-900">Saved Addresses</h2>
                                <button
                                    onClick={isAddingAddress ? onCancelEdit : () => setIsAddingAddress(true)}
                                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors h-9 px-4 py-2 
                                ${isAddingAddress
                                            ? "border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700"
                                            : "bg-primary text-white hover:bg-primary/90 shadow-sm"
                                        }`}
                                >
                                    {isAddingAddress ? <><X className="h-4 w-4 mr-2" /> Cancel</> : <><Plus className="h-4 w-4 mr-2" /> Add New</>}
                                </button>
                            </div>

                            {isAddingAddress && (
                                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                    <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                                        <h3 className="font-semibold text-zinc-900">{editingId ? 'Edit Address' : 'New Address'}</h3>
                                    </div>
                                    <div className="p-6">
                                        <AddressForm
                                            initialValues={editingAddress}
                                            addressId={editingId}
                                            onCancel={onCancelEdit}
                                            onSuccess={handleSuccess}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-4">
                                {addresses.length === 0 && !isAddingAddress && (
                                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-zinc-200">
                                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <MapPin className="h-8 w-8 text-zinc-300" />
                                        </div>
                                        <h3 className="text-lg font-medium text-zinc-900 mb-1">No addresses found</h3>
                                        <p className="text-zinc-500">Add an address to start ordering food.</p>
                                    </div>
                                )}

                                {addresses.map((addr, index) => (
                                    <div key={addr.id || index} className="bg-white p-5 rounded-xl border border-zinc-200 hover:border-primary/50 hover:shadow-md transition-all duration-200 flex items-start justify-between group">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 bg-orange-50 text-primary p-2.5 rounded-lg shrink-0">
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-zinc-900">{addr.street}</h4>
                                                <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
                                                    {addr.buildingNumber}/{addr.apartmentNumber}<br />
                                                    {addr.postalCode} {addr.district}, {addr.province}<br />
                                                    {addr.countryCode}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-primary hover:bg-orange-50 transition-colors"
                                                onClick={() => onEditClick(addr)}
                                                title="Edit Address"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                onClick={() => onDeleteAddress(addr.id)}
                                                title="Delete Address"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-20">Loading profile...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
