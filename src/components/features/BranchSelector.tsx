"use client";

import React from 'react';
import { useBranch } from '@/context/BranchContext';
import { useUser } from '@/context/UserContext';
import { ChevronDown } from 'lucide-react';
import { AddressSearch } from '@/components/features/AddressSearch';
import { Branch, BranchDetails } from '@/types/branch';

// Helper to get day name
const getDayName = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
};

export function BranchSelector() {
    const { selectedBranch, branches, selectBranch, isLoading, searchBranches } = useBranch();
    const { addresses } = useUser(); // Get addresses from UserContext
    const [nearbyBranches, setNearbyBranches] = React.useState<Branch[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'workingHours' | 'contact'>('workingHours');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const branchDetails = React.useMemo(() => {
        if (!selectedBranch) return null;

        // Parse Working Hours
        const today = getDayName();
        // @ts-ignore
        const todayHours = selectedBranch.business_hour?.[today];
        let workingHours = 'Closed Today';

        if (todayHours?.isOpen && todayHours?.timeSlots?.length > 0) {
            const slot = todayHours.timeSlots[0];
            workingHours = `${slot.openTime} - ${slot.closeTime}`;
        }

        // Parse Payment Methods
        const paymentMethods: string[] = [];
        const paymentSettings = selectedBranch.payment_settings;
        if (paymentSettings?.onlineMethods?.card?.isActive) paymentMethods.push('Online Card');
        if (paymentSettings?.offlineMethods?.cash?.isActive) paymentMethods.push('Cash');
        if (paymentSettings?.offlineMethods?.cardOnDelivery?.isActive) paymentMethods.push('Card on Delivery');

        // Parse Delivery Options
        const deliveryOptions: string[] = [];
        const orderTypeSettings = selectedBranch.order_type_settings;
        if (orderTypeSettings?.delivery?.isActive) deliveryOptions.push('Delivery');
        if (orderTypeSettings?.pickup?.isActive) deliveryOptions.push('Pickup');
        if (orderTypeSettings?.scheduledDelivery?.isActive) deliveryOptions.push('Scheduled');

        return {
            workingHours,
            minimumDeliveryAmount: selectedBranch.minBasketPrice || 0,
            paymentMethods,
            deliveryOptions,
            phoneNumber: selectedBranch.phoneNumber || 'Not provided',
        };
    }, [selectedBranch]);

    const activeAddress = addresses.find(a => a.isActive);
    const activeAddressString = activeAddress
        ? `${activeAddress.street}, ${activeAddress.district}, ${activeAddress.province}`
        : undefined;

    // Click outside handler to close dropdown
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync context branches to local state initially
    React.useEffect(() => {
        setNearbyBranches(branches);
    }, [branches]);

    const handleAddressSelect = async (lat: number, lng: number, address: string) => {
        setIsSearching(true);
        try {
            await searchBranches(lat, lng, address);
            // Context updates branches, which triggers effect above to update nearbyBranches
        } catch (error) {
            console.error("Failed to fetch branches for address", error);
        } finally {
            setIsSearching(false);
        }
    };

    if (isLoading) return <div className="animate-pulse h-10 w-48 bg-zinc-100 rounded"></div>;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-100 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="flex-1 w-full">

                    {/* Address Search Section */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-zinc-900 mb-2">Enter Neighborhood first, then Street</h3>
                        <AddressSearch
                            onAddressSelect={handleAddressSelect}
                            className="w-full max-w-md"
                            initialValue={activeAddressString}
                        />
                    </div>

                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-zinc-800 mb-1">
                            {selectedBranch ? selectedBranch.name : 'Branches available for order'}
                        </h2>
                        {/* Branch Selection Dropdown */}
                        <div className="relative inline-block" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                            >
                                {selectedBranch ? 'Change Branch' : 'Select Branch'} <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-zinc-200 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                                    {isSearching ? (
                                        <div className="p-4 text-center text-sm text-zinc-500">Searching...</div>
                                    ) : nearbyBranches.length > 0 ? (
                                        nearbyBranches.map(branch => (
                                            <button
                                                key={branch.id}
                                                onClick={() => { selectBranch(branch); setIsDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-3 text-sm hover:bg-orange-50 border-b border-zinc-50 last:border-0 ${selectedBranch?.id === branch.id ? 'bg-orange-50 text-orange-600 font-medium' : 'text-zinc-600'}`}
                                            >
                                                <div className="font-medium">{branch.name}</div>
                                                <div className="text-xs text-zinc-400 mt-0.5 truncate">{branch.addressText}</div>
                                                {branch.distanceM && (
                                                    <div className="text-[10px] text-orange-400 mt-1">
                                                        {(branch.distanceM / 1000).toFixed(1)} km
                                                    </div>
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-zinc-500">
                                            No branches found in this location.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedBranch && branchDetails && (
                        <div className="mt-4 text-sm text-zinc-500 space-y-1">
                            <p>Minimum Delivery Amount: {branchDetails.minimumDeliveryAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} TL</p>
                            <p>Payment: {branchDetails.paymentMethods.join(', ')}</p>
                            <p>{branchDetails.deliveryOptions.join(', ')}</p>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                {selectedBranch && branchDetails && (
                    <div className="hidden md:block w-auto shrink-0">
                        <div className="flex border-b border-zinc-200 mb-2">
                            <button
                                onClick={() => setActiveTab('workingHours')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'workingHours' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
                            >
                                Working Hours
                            </button>
                            <button
                                onClick={() => setActiveTab('contact')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'contact' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
                            >
                                Contact
                            </button>
                        </div>
                        <div className="text-xs text-zinc-500 min-h-[3rem]">
                            {activeTab === 'workingHours' ? (
                                <>
                                    <span className="block font-medium text-zinc-700 mb-1">Today</span>
                                    {branchDetails.workingHours}
                                </>
                            ) : (
                                <>
                                    <span className="block font-medium text-zinc-700 mb-1">Phone Number</span>
                                    {branchDetails.phoneNumber}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
