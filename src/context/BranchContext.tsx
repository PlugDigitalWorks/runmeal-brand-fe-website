'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { branchService } from '@/services/branch.service';
// import { userService } from '@/services/user.service'; // Removed unused
import { Branch } from '@/types/branch';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';

interface GuestAddress {
    latitude: number;
    longitude: number;
    formattedAddress: string;
}

interface BranchContextType {
    selectedBranch: Branch | null;
    branches: Branch[];
    isLoading: boolean;
    selectBranch: (branch: Branch) => void;
    searchBranches: (lat: number, lng: number, addressString?: string) => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const { addresses, isLoading: isUserLoading } = useUser();
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const initBranch = async () => {
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
                        setBranches(data || []);
                        if (data && data.length > 0) {
                            setSelectedBranch(data[0]);
                        }
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
    }, [isAuthenticated, addresses, isUserLoading]);

    const selectBranch = (branch: Branch) => {
        setSelectedBranch(branch);
        if (!isAuthenticated) {
            localStorage.setItem('guest_branch', JSON.stringify(branch));
        }
    };

    const searchBranches = async (lat: number, lng: number, addressString?: string) => {
        setIsLoading(true);
        try {
            const data = await branchService.getNearbyBranches(lat, lng);
            setBranches(data || []);
            // Optional: Auto select first?
            // Usually search implies we want to see options, but auto-selecting the nearest is often good UX.
            if (data && data.length > 0) {
                setSelectedBranch(data[0]);
            } else {
                setSelectedBranch(null as any);
            }

            // Save guest address for sync on login
            if (!isAuthenticated && addressString) {
                const guestAddress: GuestAddress = {
                    latitude: lat,
                    longitude: lng,
                    formattedAddress: addressString
                };
                localStorage.setItem('guest_address', JSON.stringify(guestAddress));
            }
        } catch (err) {
            console.error("Manual search failed", err);
            setBranches([]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BranchContext.Provider value={{ selectedBranch, branches, isLoading, selectBranch, searchBranches }}>
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
