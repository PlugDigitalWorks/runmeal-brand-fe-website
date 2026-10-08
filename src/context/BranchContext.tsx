'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { branchService } from '@/services/branch.service';
import { isBranchSelectable } from '@/lib/branch-details';
import type { Branch, BranchAvailabilityResponse, BrandBranch } from '@/types/branch';
import { useAuth } from './AuthContext';
import { useTable } from './TableContext';
import { useUser } from './UserContext';

interface BranchContextType {
    selectedBranch: Branch | BrandBranch | null;
    /**
     * Every open branch of the brand (`nearby/brand/all`), relative to the
     * user's active saved address when there is one, else unlocated.
     */
    branches: Array<Branch | BrandBranch>;
    isLoading: boolean;
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
    availability: BranchAvailabilityResponse | null;
    isAvailabilityLoading: boolean;
    hasAvailabilityError: boolean;
    refreshAvailability: () => Promise<BranchAvailabilityResponse | null>;
    invalidateMenu: () => void;
    selectBranch: (branch: Branch | BrandBranch) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const SELECTED_BRANCH_KEY = 'selected_branch_id';

const readStoredBranchId = () => {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem(SELECTED_BRANCH_KEY);
    } catch {
        return null;
    }
};

const writeStoredBranchId = (branchId: string) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SELECTED_BRANCH_KEY, branchId);
    } catch {
    }
};

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const { addresses, isLoading: isUserLoading } = useUser();
    const { isTableMode, journey } = useTable();
    const [selectedBranch, setSelectedBranch] = useState<Branch | BrandBranch | null>(null);
    const [branches, setBranches] = useState<Array<Branch | BrandBranch>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [menuRevision, setMenuRevision] = useState(0);
    const [availability, setAvailability] = useState<BranchAvailabilityResponse | null>(null);
    const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
    const [hasAvailabilityError, setHasAvailabilityError] = useState(false);

    const invalidateMenu = useCallback(() => setMenuRevision((revision) => revision + 1), []);

    const tableBranchId = isTableMode ? journey?.branchId ?? null : null;
    const activeBranchId = tableBranchId ?? selectedBranch?.id ?? null;

    const refreshAvailability = useCallback(async () => {
        if (!activeBranchId) {
            setAvailability(null);
            setHasAvailabilityError(false);
            return null;
        }

        setIsAvailabilityLoading(true);
        setHasAvailabilityError(false);
        try {
            const nextAvailability = await branchService.getAvailability(activeBranchId);
            setAvailability(nextAvailability);
            return nextAvailability;
        } catch (error) {
            console.error('Failed to load branch availability', error);
            setHasAvailabilityError(true);
            return null;
        } finally {
            setIsAvailabilityLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        setAvailability(null);
        void refreshAvailability();
    }, [refreshAvailability]);

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

            // A guest cart belongs to one branch; keep it selected so the cart stays valid.
            let cartBranch: Branch | null = null;
            if (!isAuthenticated) {
                const guestCart = localStorage.getItem('guest_cart');
                const guestBranch = localStorage.getItem('guest_branch');

                if (guestCart) {
                    try {
                        const items = JSON.parse(guestCart);
                        if (items.length > 0) {
                            if (guestBranch) {
                                cartBranch = JSON.parse(guestBranch);
                            } else if (items[0].branchId) {
                                // Only the id is stored with the items; fetch the rest and self-heal storage.
                                cartBranch = await branchService.getBranchDetails(items[0].branchId);
                                if (cartBranch) {
                                    localStorage.setItem('guest_branch', JSON.stringify(cartBranch));
                                }
                            }
                            if (cartBranch) setSelectedBranch(cartBranch);
                        }
                    } catch (e) {
                        console.error("Failed to restore guest branch", e);
                    }
                }
            }

            // Every open branch, measured from the active saved address when there is one.
            const activeAddress = isAuthenticated ? addresses.find(a => a.isActive) : undefined;
            setIsLoading(true);
            try {
                const nextBranches = (await branchService.getBrandBranches(activeAddress ?? null)) || [];
                setBranches(nextBranches);
                const storedBranchId = readStoredBranchId();
                setSelectedBranch((currentBranch) => {
                    const listed = (id?: string | null) =>
                        id ? nextBranches.find((branch) => branch.id === id && isBranchSelectable(branch)) : undefined;
                    if (cartBranch) return listed(cartBranch.id) || cartBranch;
                    return (
                        listed(currentBranch?.id) ||
                        listed(storedBranchId) ||
                        // Nearest branch that delivers to the active address.
                        nextBranches.find((branch) => branch.canDeliver === true) ||
                        (nextBranches.length === 1 && isBranchSelectable(nextBranches[0]) ? nextBranches[0] : null)
                    );
                });
            } catch (err) {
                console.error("Failed to load brand branches", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (!isUserLoading) {
            initBranch();
        }
    }, [isAuthenticated, addresses, isUserLoading, isTableMode]);

    const selectBranch = (branch: Branch | BrandBranch) => {
        if (isTableMode) return;
        setSelectedBranch(branch);
        writeStoredBranchId(branch.id);
        if (!isAuthenticated) {
            localStorage.setItem('guest_branch', JSON.stringify(branch));
        }
    };

    return (
        <BranchContext.Provider value={{
            selectedBranch,
            branches,
            isLoading,
            activeBranchId,
            menuRevision,
            invalidateMenu,
            selectBranch,
            availability,
            isAvailabilityLoading,
            hasAvailabilityError,
            refreshAvailability,
        }}>
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
