"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBranch } from '@/context/BranchContext';
import { useUser } from '@/context/UserContext';
import { ChevronDown } from 'lucide-react';
import { AddressSearch } from '@/components/features/AddressSearch';
import { BranchContactLink, BranchInfoTabs } from '@/components/features/BranchInfoTabs';
import { resolveBranchDetails } from '@/lib/branch-details';
import { formatCurrency } from '@/lib/utils';
import type { Branch } from '@/types/branch';

/**
 * The address/branch context panel that sits above the menu on the storefront.
 * A QR journey renders `TableInfoPanel` in the same slot instead — the branch
 * there comes from the scanned table, so there is nothing to search or pick.
 */
export function BranchSelector() {
    const { t } = useTranslation();
    const { selectedBranch, branches, selectBranch, isLoading, searchedAddress, searchBranches } = useBranch();
    const { addresses } = useUser(); // Get addresses from UserContext
    const [nearbyBranches, setNearbyBranches] = React.useState<Branch[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const branchDetails = React.useMemo(() => resolveBranchDetails(selectedBranch), [selectedBranch]);

    const activeAddress = addresses.find(a => a.isActive);
    const activeAddressString = activeAddress
        ? `${activeAddress.street}, ${activeAddress.district}, ${activeAddress.province}`
        : undefined;
    const searchInputValue = searchedAddress?.formattedAddress || activeAddressString;

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

    const handleAddressSelect = async (address: Parameters<typeof searchBranches>[0]) => {
        setIsSearching(true);
        try {
            await searchBranches(address);
            // Context updates branches, which triggers effect above to update nearbyBranches
        } catch (error) {
            console.error("Failed to fetch branches for address", error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-100 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="flex-1 w-full">

                    {/* Address Search Section */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-zinc-900 mb-2">{t('branch.addressSearchHint')}</h3>
                        <AddressSearch
                            onAddressSelect={handleAddressSelect}
                            className="w-full max-w-md"
                            initialValue={searchInputValue}
                        />
                    </div>

                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-zinc-800 mb-1">
                            {selectedBranch ? selectedBranch.name : isLoading ? t('branch.loading') : t('branch.availableBranches')}
                        </h2>
                        {/* Branch Selection Dropdown */}
                        <div className="relative inline-block" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                            >
                                {selectedBranch ? t('branch.change') : t('branch.select')} <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-zinc-200 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                                    {isSearching ? (
                                        <div className="p-4 text-center text-sm text-zinc-500">{t('branch.searching')}</div>
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
                                            {t('branch.noneFound')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedBranch && branchDetails && (
                        <div className="mt-4 text-sm text-zinc-500 space-y-1">
                            <p>{t('branch.minimumOrder')}: {formatCurrency(branchDetails.minimumDeliveryAmount)}</p>
                            <p>
                                {t('branch.payment')}:{' '}
                                {branchDetails.paymentMethodKeys.map(key => t(`branch.paymentMethods.${key}`)).join(', ')}
                            </p>
                            <p>{branchDetails.orderTypeKeys.map(key => t(`branch.orderTypes.${key}`)).join(', ')}</p>
                            {/* The Contact tab above is desktop only, so mobile needs its own way in. */}
                            <BranchContactLink branch={selectedBranch} />
                        </div>
                    )}
                </div>

                {selectedBranch && branchDetails && (
                    <BranchInfoTabs branch={selectedBranch} details={branchDetails} />
                )}
            </div>
        </div>
    );
}
