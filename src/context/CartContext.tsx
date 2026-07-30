'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cartService } from '@/services/cart.service';
import { userService } from '@/services/user.service';
import {
  ApplyPromotionInput,
  Cart,
  CartItemOptionGroup,
  CartPromotion,
  promotionKey,
  RemovePromotionInput,
} from '@/types/cart';
import { resolveLoyaltyError } from '@/lib/loyalty-errors';
import i18n from '@/i18n/config';
import { useAuth } from './AuthContext';
import { useBranch } from './BranchContext';
import { useUser } from './UserContext';
import { toast } from 'sonner';

// Simplified Cart Item for Guest (Local Storage)
interface GuestCartItem {
  id?: string;
  productId: string;
  quantity: number;
  options?: CartItemOptionGroup[];
  addons?: { id: string; name?: string; price?: number }[];
  notes?: string;
  // We might need more product details for UI if we don't fetch fresh prod data every time
  // For now storing minimal info
  productName?: string;
  price?: number;
  currency?: string;
  currencySymbol?: string;
  branchId?: string;
}

const DEFAULT_ORDER_TYPE = 'DELIVERY';

/** Identifies an in-flight promotion mutation; `*` covers "remove every promotion of this provider". */
const promotionMutationKey = ({ type, promotionCode }: RemovePromotionInput) =>
  `${type}:${promotionCode ?? '*'}`;

const getGuestItemKey = (
  productId: string,
  options?: CartItemOptionGroup[],
  addons?: { id: string; name?: string; price?: number }[],
  notes?: string,
) => `${productId}:${JSON.stringify(options ?? [])}:${JSON.stringify(addons ?? [])}:${notes?.trim() || ''}`;

interface CartContextType {
  cart: Cart | null; // For User
  guestCartItems: GuestCartItem[]; // For Guest
  isLoading: boolean;
  addToCart: (
    productId: string,
    quantity: number,
    options?: { optionId: string; valueId: string; name?: string; valueName?: string; price?: number }[],
    addons?: { id: string; name?: string; price?: number }[],
    notes?: string,
    productDetails?: any
  ) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>; // ItemId for user, ProductId for guest
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  cartTotal: number;
  refreshCart: () => Promise<void>;

  // Promotions — internal Runmeal coupons and Rekonect campaigns share one model.
  availablePromotions: CartPromotion[];
  isPromotionsLoading: boolean;
  hasPromotionsError: boolean;
  refreshAvailablePromotions: () => Promise<void>;
  applyPromotion: (input: ApplyPromotionInput) => Promise<boolean>;
  removePromotion: (input: RemovePromotionInput) => Promise<boolean>;
  isPromotionPending: (input: RemovePromotionInput) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { selectedBranch } = useBranch();
  const { refreshAddresses } = useUser();
  const [cart, setCart] = useState<Cart | null>(null);
  const [guestCartItems, setGuestCartItems] = useState<GuestCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availablePromotions, setAvailablePromotions] = useState<CartPromotion[]>([]);
  const [isPromotionsLoading, setIsPromotionsLoading] = useState(false);
  const [hasPromotionsError, setHasPromotionsError] = useState(false);
  const [pendingPromotionKeys, setPendingPromotionKeys] = useState<Set<string>>(new Set());
  // Synchronous mirror of pendingPromotionKeys: state updates are async, so a
  // rapid double click could otherwise fire two mutations for the same promotion.
  const pendingPromotionKeysRef = useRef<Set<string>>(new Set());

  const markPromotionPending = (key: string): boolean => {
    if (pendingPromotionKeysRef.current.has(key)) return false;
    pendingPromotionKeysRef.current.add(key);
    setPendingPromotionKeys(new Set(pendingPromotionKeysRef.current));
    return true;
  };

  const clearPromotionPending = (key: string) => {
    pendingPromotionKeysRef.current.delete(key);
    setPendingPromotionKeys(new Set(pendingPromotionKeysRef.current));
  };
  const hasSyncedRef = useRef(false); // Track if cart has been synced to prevent duplicate syncs

  const getPreferredCartId = useCallback(
    (carts: Cart[], branchId?: string | null) => {
      const preferredCart = branchId
        ? carts.find((candidate) => candidate.branchId === branchId)
        : carts[0];
      return preferredCart?.id || preferredCart?.cartId || null;
    },
    [],
  );

  const refreshUserCart = useCallback(
    async (preferredBranchId?: string | null) => {
      const carts = await cartService.getAllCarts();
      if (!carts || carts.length === 0) {
        setCart(null);
        return null;
      }

      const cartId = getPreferredCartId(carts, preferredBranchId || selectedBranch?.id);
      if (!cartId) {
        setCart(null);
        return null;
      }

      const fullCart = await cartService.getCart(cartId);
      setCart(fullCart);
      return fullCart;
    },
    [getPreferredCartId, selectedBranch?.id],
  );

  // Cart mutation responses (add/remove/qty, apply/remove promotion) are the
  // full revalidated cart. Backend values are the single source of truth for
  // totals and appliedPromotions, so write them straight into state. Merge over
  // the previous cart to keep fields the mutation payload may omit.
  const applyCartResponse = useCallback((updated: unknown): boolean => {
    if (
      updated &&
      typeof updated === 'object' &&
      ('items' in updated || 'cartId' in updated || 'id' in updated)
    ) {
      const updatedCart = updated as Cart;
      setCart(prev => (prev ? { ...prev, ...updatedCart } : updatedCart));
      return true;
    }
    return false;
  }, []);

  const refreshCart = useCallback(async () => {
    await refreshUserCart(selectedBranch?.id || cart?.branchId);
  }, [refreshUserCart, selectedBranch?.id, cart?.branchId]);

  // Load Guest Cart
  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem('guest_cart');
      if (stored) {
        try {
          const parsedItems = JSON.parse(stored) as GuestCartItem[];
          const normalizedItems = parsedItems.map(item => ({
            ...item,
            id: item.id || getGuestItemKey(item.productId, item.options, item.addons, item.notes),
          }));
          setGuestCartItems(normalizedItems);
          localStorage.setItem('guest_cart', JSON.stringify(normalizedItems));
        } catch (e) {
          console.error("Failed to parse guest cart", e);
        }
      }
    }
  }, [isAuthenticated]);

  // Load User Cart
  useEffect(() => {
    const loadUserCart = async () => {
      if (isAuthenticated) {
        setIsLoading(true);
        try {
          const fullCart = await refreshUserCart(selectedBranch?.id);
          console.log('CartContext: loadUserCart fullCart result:', fullCart);
        } catch (err) {
          console.error("Failed to load user cart", err);
        } finally {
          setIsLoading(false);
        }
      } else {
        setCart(null);
      }
    };
    loadUserCart();
  }, [isAuthenticated, refreshUserCart, selectedBranch?.id]);

  // SYNC Logic: Guest -> User
  // Triggered when user becomes authenticated and has guest items
  // SYNC Logic: Guest -> User
  // Triggered when user becomes authenticated and has guest items
  useEffect(() => {
    const syncCart = async () => {
      // Sync if authenticated, has items, AND has a selected branch (target for sync)
      if (!isAuthenticated || guestCartItems.length === 0 || !selectedBranch?.id) {
        return;
      }

      console.log("Syncing guest cart to user...");
      setIsLoading(true);
      let syncFailed = false;

      try {
        // Step 1: Sync guest address to user account BEFORE syncing cart items
        // This ensures the branch delivery validation passes
        const guestAddressStr = localStorage.getItem('guest_address');
        if (guestAddressStr) {
          try {
            const guestAddress = JSON.parse(guestAddressStr);
            console.log("Syncing guest address to user account...", guestAddress);

            // Parse address from formatted string (e.g., "Street, District, Province")
            const addressParts = guestAddress.formattedAddress.split(',').map((p: string) => p.trim());

            await userService.createAddress({
              countryCode: 'TR',
              province: addressParts[2] || addressParts[1] || 'Unknown',
              district: addressParts[1] || 'Unknown',
              postalCode: '00000',
              street: addressParts[0] || guestAddress.formattedAddress,
              buildingNumber: '-',
              apartmentNumber: '-',
              latitude: guestAddress.latitude,
              longitude: guestAddress.longitude,
              isActive: true // This will make it the active address
            });

            // Refresh addresses so BranchContext can use the new active address
            await refreshAddresses();
            localStorage.removeItem('guest_address');
            console.log("Guest address synced successfully");
          } catch (addrError) {
            console.error("Failed to sync guest address, continuing with cart sync...", addrError);
            // Don't fail the whole sync if address creation fails
          }
        }
        for (const item of guestCartItems) {
          try {
            // Map nested guest options back to flat structure for backend API
            const options: { groupId: string; optionId?: string; optionIds?: string[] }[] = [];
            item.options?.forEach(group => {
              if (group.type === 'MULTI') {
                const ids = group.selections.map(s => s.optionId);
                if (ids.length > 0) {
                  options.push({
                    groupId: group.groupId,
                    optionIds: ids
                  });
                }
              } else {
                group.selections.forEach(sel => {
                  options.push({
                    groupId: group.groupId,
                    optionId: sel.optionId
                  });
                });
              }
            });

            // Fallback: Retrieve guest_branch manually if context is not ready
            const storedGuestBranch = localStorage.getItem('guest_branch');
            let fallbackBranchId: string | undefined;
            if (storedGuestBranch) {
              try { fallbackBranchId = JSON.parse(storedGuestBranch).id; } catch { }
            }

            await cartService.addItem({
              productId: item.productId,
              qty: item.quantity,
              options,
              note: item.notes?.trim() || undefined,
            }, item.branchId || selectedBranch?.id || fallbackBranchId);
          } catch (e) {
            console.error(`Failed to sync item ${item.productId}`, e);
            syncFailed = true;
          }
        }

        if (!syncFailed) {
          setGuestCartItems([]);
          localStorage.removeItem('guest_cart');
          localStorage.removeItem('guest_branch');
          console.log("Guest cart synced and cleared.");
        } else {
          console.warn("Some items failed to sync. Guest cart retained.");
        }

        // Refresh user cart regardless
        await refreshUserCart(selectedBranch?.id);

      } catch (err) {
        console.error("Failed to sync cart process", err);
      } finally {
        setIsLoading(false);
      }
    };

    syncCart();
  }, [isAuthenticated, guestCartItems, selectedBranch]);


  const addToCart = async (
    productId: string,
    quantity: number,
    options?: { groupId?: string; optionId?: string; optionIds?: string[]; valueId?: string; name?: string; valueName?: string; price?: number }[],
    addons?: { id: string; name?: string; price?: number }[],
    notes?: string,
    productDetails?: any
  ) => {
    // ONLY use backend if authenticated AND a branch is selected (address is valid)
    if (isAuthenticated && selectedBranch?.id) {

      setIsLoading(true);
      try {
        let optionsDto: any[] | undefined;

        if (options && options.length > 0 && 'groupId' in options[0]) {
          // New format: { groupId, optionId, optionIds }
          // Pass strict passthrough for backend
          optionsDto = options;
        } else {
          // Legacy mapping
          optionsDto = options?.map(o => ({
            groupId: o.optionId,
            optionId: o.valueId
          }));
        }

        const updatedCart = await cartService.addItem({
          productId,
          qty: quantity,
          options: optionsDto,
          note: notes?.trim() || undefined,
        }, selectedBranch.id);

        toast.success('Item added to cart');

        if (!applyCartResponse(updatedCart)) {
          await refreshUserCart(selectedBranch.id);
        }
      } catch (e: any) {
        console.error("Add to cart failed", e);
        toast.error(e.response?.data?.message || 'Failed to add item to cart');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Guest Logic OR Logged-in-but-no-address Logic
      // Stores in local storage until address/branch is available
      const nestedOptions: CartItemOptionGroup[] = [];

      if (options) {
        const groups: Record<string, CartItemOptionGroup> = {};

        options.forEach(opt => {
          let groupId: string, groupName: string, optionName: string, priceDelta: number;

          if ('groupId' in opt) {
            groupId = opt.groupId as string;
            groupName = opt.name || 'Option Group';
            optionName = opt.valueName || 'Option Value';
            priceDelta = opt.price || 0;

            if (!groups[groupId]) {
              groups[groupId] = {
                groupId: groupId,
                groupName: groupName,
                type: (opt.optionIds && opt.optionIds.length > 0) ? 'MULTI' : 'VARIANT',
                selections: []
              };
            }

            if (opt.optionIds && Array.isArray(opt.optionIds)) {
              // Handle Multi
              opt.optionIds.forEach(id => {
                groups[groupId].selections.push({
                  action: 'SELECT',
                  optionId: id,
                  optionName: optionName, // Warning: Shared name
                  priceDelta: priceDelta // Warning: Shared price or 0?
                });
              });
            } else if (opt.optionId) {
              // Handle Single
              groups[groupId].selections.push({
                action: 'SELECT',
                optionId: opt.optionId,
                optionName: optionName,
                priceDelta: priceDelta
              });
            }

          } else {
            // Legacy Format
            const legacyOpt = opt as any;
            groupId = legacyOpt.optionId;
            const singleOptionId = legacyOpt.valueId;
            groupName = legacyOpt.name || 'Option';
            optionName = legacyOpt.valueName || 'Value';
            priceDelta = legacyOpt.price || 0;

            if (!groups[groupId]) {
              groups[groupId] = {
                groupId: groupId,
                groupName: groupName,
                type: 'VARIANT',
                selections: []
              };
            }
            groups[groupId].selections.push({
              action: 'SELECT',
              optionId: singleOptionId,
              optionName: optionName,
              priceDelta: priceDelta
            });
          }
        });

        Object.values(groups).forEach(g => nestedOptions.push(g));
      }

      const updated = [...guestCartItems];
      const guestItemKey = getGuestItemKey(productId, nestedOptions, addons, notes);
      // Check for existing item with SAME options
      const existing = updated.findIndex(i =>
        (i.id || getGuestItemKey(i.productId, i.options, i.addons, i.notes)) === guestItemKey
      );

      if (existing >= 0) {
        updated[existing].quantity += quantity;
        updated[existing].id = guestItemKey;
        // Update branchId if missing (self-healing)
        if (!updated[existing].branchId && selectedBranch) {
          updated[existing].branchId = selectedBranch.id;
        }
      } else {
        updated.push({
          id: guestItemKey,
          productId,
          quantity,
          options: nestedOptions,
          addons,
          notes: notes?.trim() || undefined,
          productName: productDetails?.name,
          price: Number(productDetails?.discountedPrice || productDetails?.price || 0),
          currency: productDetails?.currency,
          currencySymbol: productDetails?.currencySymbol,
          branchId: selectedBranch?.id
        });
      }
      setGuestCartItems(updated);
      localStorage.setItem('guest_cart', JSON.stringify(updated));

      // Persist related branch for restoration (Redundant but keeps context-level restoration easy)
      if (selectedBranch) {
        localStorage.setItem('guest_branch', JSON.stringify(selectedBranch));
      }

      toast.success('Item added to cart');
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        const updatedCart = await cartService.removeItem(itemId, selectedBranch?.id);
        if (!applyCartResponse(updatedCart)) {
          await refreshUserCart(selectedBranch?.id || cart?.branchId);
        }
      } catch (e) {
        console.error("Remove failed", e);
      } finally {
        setIsLoading(false);
      }
    } else {
      // itemId is the local guest item key
      const updated = guestCartItems.filter(i => (i.id || i.productId) !== itemId);
      setGuestCartItems(updated);
      localStorage.setItem('guest_cart', JSON.stringify(updated));
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        const updatedCart = await cartService.setQty({ itemId, qty: quantity }, selectedBranch?.id);
        if (!applyCartResponse(updatedCart)) {
          await refreshUserCart(selectedBranch?.id || cart?.branchId);
        }
      } catch (e) {
        console.error("Update qty failed", e);
      } finally {
        setIsLoading(false);
      }
    } else {
      // itemId is the local guest item key
      if (quantity <= 0) {
        await removeFromCart(itemId);
        return;
      }
      const updated = [...guestCartItems];
      const existing = updated.findIndex(i => (i.id || i.productId) === itemId);
      if (existing >= 0) {
        updated[existing].quantity = quantity;
        setGuestCartItems(updated);
        localStorage.setItem('guest_cart', JSON.stringify(updated));
      }
    }
  };

  // --- Promotions ---------------------------------------------------------

  const cartId = cart?.id || cart?.cartId;

  const refreshAvailablePromotions = useCallback(async () => {
    if (!isAuthenticated || !cartId) return;
    setIsPromotionsLoading(true);
    try {
      const promotions = await cartService.getAvailablePromotions(cartId, DEFAULT_ORDER_TYPE);
      setAvailablePromotions(promotions);
      setHasPromotionsError(false);
    } catch (e) {
      // A failed list must never break checkout — surface it inline instead.
      console.error("Failed to fetch available promotions", e);
      setHasPromotionsError(true);
    } finally {
      setIsPromotionsLoading(false);
    }
  }, [isAuthenticated, cartId]);

  // Load the promotion list once a cart ID exists and re-fetch whenever cart
  // items or applied promotions change, since applicability depends on both.
  const promotionsSignature = cart
    ? JSON.stringify({
      items: (cart.items || []).map(item => [item.id, item.qty]),
      applied: (cart.appliedPromotions || []).map(promotionKey),
    })
    : '';

  useEffect(() => {
    if (!isAuthenticated || !cartId) {
      setAvailablePromotions([]);
      setHasPromotionsError(false);
      return;
    }
    refreshAvailablePromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, cartId, promotionsSignature]);

  const isPromotionPending = useCallback(
    (input: RemovePromotionInput) => pendingPromotionKeys.has(promotionMutationKey(input)),
    [pendingPromotionKeys],
  );

  /** Backend already dropped whatever stopped being valid — resync from it. */
  const handlePromotionError = async (error: unknown, fallbackKey: string) => {
    const { code, message } = resolveLoyaltyError(error);
    toast.error(message || i18n.t(fallbackKey));

    if (code === 'LOYALTY_PROMOTION_NO_LONGER_APPLICABLE' || code === 'LOYALTY_PROMOTION_NOT_FOUND_ON_CART') {
      await refreshCart();
    }
  };

  const applyPromotion = async (input: ApplyPromotionInput) => {
    if (!isAuthenticated || !cartId || !input.promotionCode) return false;
    // Guard against double clicks / concurrent mutations for the same promotion.
    const pendingKey = promotionMutationKey(input);
    if (!markPromotionPending(pendingKey)) return false;

    try {
      const updatedCart = await cartService.applyPromotion(cartId, input, DEFAULT_ORDER_TYPE);
      applyCartResponse(updatedCart);
      toast.success(i18n.t('loyalty.applySuccess'));
      return true;
    } catch (e) {
      console.error("Apply promotion failed", e);
      await handlePromotionError(e, 'loyalty.applyFailed');
      return false;
    } finally {
      clearPromotionPending(pendingKey);
    }
  };

  const removePromotion = async (input: RemovePromotionInput) => {
    if (!isAuthenticated || !cartId) return false;
    const pendingKey = promotionMutationKey(input);
    if (!markPromotionPending(pendingKey)) return false;

    try {
      const updatedCart = await cartService.removePromotion(cartId, input);
      applyCartResponse(updatedCart);
      toast.success(i18n.t('loyalty.removeSuccess'));
      return true;
    } catch (e) {
      console.error("Remove promotion failed", e);
      await handlePromotionError(e, 'loyalty.removeFailed');
      return false;
    } finally {
      clearPromotionPending(pendingKey);
    }
  };

  const cartTotal = isAuthenticated
    ? (cart?.totalCartPrice || 0)
    : guestCartItems.reduce((acc, item) => acc + ((item.price || 0) * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      cart,
      guestCartItems,
      isLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      cartTotal,
      refreshCart,
      availablePromotions,
      isPromotionsLoading,
      hasPromotionsError,
      refreshAvailablePromotions,
      applyPromotion,
      removePromotion,
      isPromotionPending
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
