'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { branchService } from '@/services/branch.service';
import { userService } from '@/services/user.service';
import {
    buildAddressDtoFromSelection,
    isSameDeliveryLocation,
} from '@/lib/address-parsing';
import type { DeliveryAddressSelection } from '@/lib/address-parsing';
import type { Branch } from '@/types/branch';
import { useAuth } from './AuthContext';
import { useTable } from './TableContext';
import { useUser } from './UserContext';

interface BranchContextType {
    selectedBranch: Branch | null;
    branches: Branch[];
    isLoading: boolean;
    searchedAddress: DeliveryAddressSelection | null;
    /**
     * The branch every menu/cart call should use.
     *
     * In a QR journey this is known from the resolved token straight away,
     * while `selectedBranch` only fills in once `GET /branches/:id` (which
     * needs a session) comes back — so consumers that just need an id must
     * read this instead of waiting for the full record.
     */
    activeBranchId: string | null;
    /**
     * Bumped whenever the branch menu we rendered is known to be stale — a
     * cart/product validation error means the backend disagrees with the
     * availability or price we showed. Menu consumers refetch on change.
     */
    menuRevision: number;
    invalidateMenu: () => void;
    selectBranch: (branch: Branch) => void;
    searchBranches: (address: DeliveryAddressSelection) => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const { addresses, isLoading: isUserLoading, refreshAddresses } = useUser();
    const { isTableMode, journey } = useTable();
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchedAddress, setSearchedAddress] = useState<DeliveryAddressSelection | null>(null);
    const [menuRevision, setMenuRevision] = useState(0);

    const invalidateMenu = useCallback(() => setMenuRevision((revision) => revision + 1), []);

    const tableBranchId = isTableMode ? journey?.branchId ?? null : null;
    const activeBranchId = tableBranchId ?? selectedBranch?.id ?? null;

    /**
     * QR journeys pin the branch to the scanned table — no address search, no
     * branch picker. `GET /branches/:branchId` is not public, so the details
     * only arrive once a (guest) session exists; until then consumers work off
     * `activeBranchId`.
     */
    useEffect(() => {
        if (!tableBranchId) return;
        if (selectedBranch?.id !== tableBranchId) {
            setSelectedBranch(null);
        }
        if (!isAuthenticated) return;

        let cancelled = false;
        setIsLoading(true);

        branchService
            .getBranchDetails(tableBranchId)
            .then((branch) => {
                if (cancelled || !branch) return;
                setSelectedBranch(branch);
                setBranches([branch]);
            })
            .catch((error) => {
                console.error('Failed to load table branch details', error);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
        // `selectedBranch` is intentionally not a dependency: reading it here
        // only clears a stale branch, and depending on it would re-fetch on
        // every successful load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableBranchId, isAuthenticated]);

    useEffect(() => {
        const initBranch = async () => {
            // A QR journey owns the branch; the address/guest-cart heuristics
            // below would otherwise fight it for `selectedBranch`.
            if (isTableMode) return;

            // Priority 1: Restore from Guest Cart (if unauthenticated and exists)
            if (!isAuthenticated) {
                const guestCart = localStorage.getItem('guest_cart');
                const guestBranch = localStorage.getItem('guest_branch');

                if (guestCart) {
                    try {
                        const items = JSON.parse(guestCart);
                        if (items.length > 0) {
                            // Strategy 1: Explicit 'guest_branch'
                            if (guestBranch) {
                                const branch = JSON.parse(guestBranch);
                                setSelectedBranch(branch);
                                setBranches([branch]);
                                const guestAddress = localStorage.getItem('guest_address');
                                if (guestAddress) {
                                    setSearchedAddress(JSON.parse(guestAddress));
                                }
                                return;
                            }

                            // Strategy 2: Derive from first item's 'branchId' (fallback)
                            const firstItem = items[0];
                            if (firstItem.branchId) {
                                // We only have ID, need to fetch details.
                                const branchDetails = await branchService.getBranchDetails(firstItem.branchId);
                                if (branchDetails) {
                                    setSelectedBranch(branchDetails);
                                    setBranches([branchDetails]);
                                    // Self-heal storage
                                    localStorage.setItem('guest_branch', JSON.stringify(branchDetails));
                                    return;
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Failed to restore guest branch", e);
                    }
                }
            }

            // Priority 2: User Address Logic
            if (isAuthenticated && addresses.length > 0) {
                setIsLoading(true);
                try {
                    const activeAddress = addresses.find(a => a.isActive);
                    if (activeAddress) {
                        const data = await branchService.getNearbyBranches(activeAddress.latitude, activeAddress.longitude);
                        const nextBranches = data || [];
                        setBranches(nextBranches);
                        setSelectedBranch((currentBranch) => {
                            if (nextBranches.length === 0) return null;
                            return nextBranches.find((branch) => branch.id === currentBranch?.id) || nextBranches[0];
                        });
                        setSearchedAddress((currentAddress) =>
                            currentAddress || {
                                latitude: activeAddress.latitude,
                                longitude: activeAddress.longitude,
                                formattedAddress: [activeAddress.street, activeAddress.district, activeAddress.province].filter(Boolean).join(', '),
                            },
                        );
                    }
                } catch (err) {
                    console.error("Failed to init user branch", err);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        if (!isUserLoading) {
            initBranch();
        }
    }, [isAuthenticated, addresses, isUserLoading, isTableMode]);

    const selectBranch = (branch: Branch) => {
        if (isTableMode) return;
        setSelectedBranch(branch);
        if (!isAuthenticated) {
            localStorage.setItem('guest_branch', JSON.stringify(branch));
        }
    };

    const syncSearchAddress = async (address: DeliveryAddressSelection) => {
        if (!isAuthenticated) {
            localStorage.setItem('guest_address', JSON.stringify(address));
            return;
        }

        const matchingAddress = addresses.find((savedAddress) =>
            isSameDeliveryLocation(savedAddress, address),
        );

        if (matchingAddress) {
            if (!matchingAddress.isActive) {
                await userService.setActiveAddress(matchingAddress.id);
            }
        } else {
            await userService.createAddress(buildAddressDtoFromSelection(address));
        }

        await refreshAddresses();
    };

    const searchBranches = async (address: DeliveryAddressSelection) => {
        if (isTableMode) return;
        setSearchedAddress(address);
        try {
            const data = await branchService.getNearbyBranches(address.latitude, address.longitude);
            setBranches(data || []);
            // Optional: Auto select first?
            // Usually search implies we want to see options, but auto-selecting the nearest is often good UX.
            if (data && data.length > 0) {
                setSelectedBranch(data[0]);
            } else {
                setSelectedBranch(null);
            }
        } catch (err) {
            console.error("Manual search failed", err);
            setBranches([]);
            setSelectedBranch(null);
            return;
        }

        try {
            await syncSearchAddress(address);
        } catch (err) {
            console.error("Failed to sync searched address", err);
        }
    };

    return (
        <BranchContext.Provider value={{ selectedBranch, branches, isLoading, searchedAddress, activeBranchId, menuRevision, invalidateMenu, selectBranch, searchBranches }}>
            {children}
        </BranchContext.Provider>
    );
}



export function useBranch() {
    const context = useContext(BranchContext);
    if (context === undefined) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
}
