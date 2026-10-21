'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from '@/types/auth';
import { Address } from '@/types/address';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { usePathname } from 'next/navigation';

interface UserContextType {
  user: User | null;
  addresses: Address[];
  /** True until the signed-in user is known and their addresses have loaded. */
  isLoading: boolean;
  refreshAddresses: () => Promise<void>;
  tempAddress: { location: { latitude: number; longitude: number; }; formattedAddress: string; } | null;
  setTempAddress: (addr: { location: { latitude: number; longitude: number; }; formattedAddress: string; } | null) => void;
  showAddressModal: boolean;
  setShowAddressModal: (show: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  // The user comes straight from AuthContext, which is updated the moment a
  // login succeeds. A copy read here on route change was still empty on the
  // first render after login, so guarded pages (profile, member QR) sent the
  // customer straight back to /login.
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  // A failed token refresh clears the session cookies without telling
  // AuthContext; checking the cookie (re-read on every route change) keeps
  // guarded pages sending an expired session to /login.
  const user = authUser && authService.getUser() ? authUser : null;
  const userId = user?.id ?? null;
  const [addresses, setAddresses] = useState<Address[]>([]);
  // Whose addresses `addresses` holds; undefined until the first load.
  const [addressesUserId, setAddressesUserId] = useState<string | null | undefined>(undefined);
  const isLoading = isAuthLoading || addressesUserId !== userId;
  
  const [tempAddress, setTempAddress] = useState<{ location: { latitude: number; longitude: number; }; formattedAddress: string; } | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);

  const pathname = usePathname();

  const refreshAddresses = useCallback(async () => {
    try {
      const addrs = await userService.getAddresses();
      setAddresses(addrs || []);
    } catch (error) {
      console.error('Failed to fetch addresses', error);
    }
  }, []);

  // Load the addresses whenever the signed-in user changes, and again on
  // every route change so they stay fresh.
  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;

    void (async () => {
      if (userId) {
        try {
          const addrs = await userService.getAddresses();
          if (!cancelled) setAddresses(addrs || []);
        } catch (error) {
          console.error('Failed to fetch addresses', error);
        }
      } else {
        setAddresses([]);
      }
      if (!cancelled) setAddressesUserId(userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, userId, isAuthLoading]);

  return (
    <UserContext.Provider
      value={{
        user,
        addresses,
        isLoading,
        refreshAddresses,
        tempAddress,
        setTempAddress,
        showAddressModal,
        setShowAddressModal
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
