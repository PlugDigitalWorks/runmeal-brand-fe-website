'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cartService } from '@/services/cart.service';
import { userService } from '@/services/user.service';
import { Cart, CartItem, CartItemOptionGroup } from '@/types/cart';
import { useAuth } from './AuthContext';
import { useBranch } from './BranchContext';
import { useUser } from './UserContext';
import { toast } from 'sonner';

// Simplified Cart Item for Guest (Local Storage)
interface GuestCartItem {
  productId: string;
  quantity: number;
  options?: CartItemOptionGroup[];
  addons?: { id: string; name?: string; price?: number }[];
  notes?: string;
  // We might need more product details for UI if we don't fetch fresh prod data every time
  // For now storing minimal info
  productName?: string;
  price?: number;
  branchId?: string;
}

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
  applyCoupon: (couponCode: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  cartTotal: number;
  availablePromotions: any[];
  checkAvailablePromotions: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { selectedBranch } = useBranch();
  const { refreshAddresses } = useUser();
  const [cart, setCart] = useState<Cart | null>(null);
  const [guestCartItems, setGuestCartItems] = useState<GuestCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availablePromotions, setAvailablePromotions] = useState<any[]>([]);
  const hasSyncedRef = useRef(false); // Track if cart has been synced to prevent duplicate syncs

  // Load Guest Cart
  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem('guest_cart');
      if (stored) {
        try {
          setGuestCartItems(JSON.parse(stored));
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
          const carts = await cartService.getAllCarts();
          console.log('CartContext: loadUserCart carts result:', carts);

          if (carts && carts.length > 0) {
            const cartId = carts[0].id || carts[0].cartId;
            if (cartId) {
              const fullCart = await cartService.getCart(cartId);
              console.log('CartContext: loadUserCart fullCart result:', fullCart);
              setCart(fullCart);
            }
          } else {
            console.log('CartContext: loadUserCart - No carts found or empty array');
          }
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
  }, [isAuthenticated]);

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
        const carts = await cartService.getAllCarts();
        if (carts.length > 0) {
          const cartId = carts[0].id || carts[0].cartId;
          if (cartId) {
            const fullCart = await cartService.getCart(cartId);
            setCart(fullCart);
          }
        }

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

        await cartService.addItem({
          productId,
          qty: quantity,
          options: optionsDto
        }, selectedBranch.id);

        toast.success('Item added to cart');

        // Refresh cart
        const carts = await cartService.getAllCarts();
        if (carts.length > 0) {
          const cartId = carts[0].id || carts[0].cartId;
          if (cartId) {
            const fullCart = await cartService.getCart(cartId);
            setCart(fullCart);
          }
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
      // Check for existing item with SAME options
      const existing = updated.findIndex(i =>
        i.productId === productId &&
        JSON.stringify(i.options) === JSON.stringify(nestedOptions) &&
        JSON.stringify(i.addons) === JSON.stringify(addons)
      );

      if (existing >= 0) {
        updated[existing].quantity += quantity;
        // Update branchId if missing (self-healing)
        if (!updated[existing].branchId && selectedBranch) {
          updated[existing].branchId = selectedBranch.id;
        }
      } else {
        updated.push({
          productId,
          quantity,
          options: nestedOptions,
          addons,
          productName: productDetails?.name,
          price: productDetails?.price,
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
        await cartService.removeItem(itemId, selectedBranch?.id);
        // Refresh
        const carts = await cartService.getAllCarts();
        if (carts.length > 0) {
          const fullCart = await cartService.getCart(carts[0].id!);
          setCart(fullCart);
        } else {
          setCart(null);
        }
      } catch (e) {
        console.error("Remove failed", e);
      } finally {
        setIsLoading(false);
      }
    } else {
      // itemId is productId for guest
      const updated = guestCartItems.filter(i => i.productId !== itemId);
      setGuestCartItems(updated);
      localStorage.setItem('guest_cart', JSON.stringify(updated));
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        await cartService.setQty({ itemId, qty: quantity }, selectedBranch?.id);
        // Refresh
        const carts = await cartService.getAllCarts();
        if (carts.length > 0) {
          const fullCart = await cartService.getCart(carts[0].id!);
          setCart(fullCart);
        }
      } catch (e) {
        console.error("Update qty failed", e);
      } finally {
        setIsLoading(false);
      }
    } else {
      // itemId is productId
      if (quantity <= 0) {
        await removeFromCart(itemId);
        return;
      }
      const updated = [...guestCartItems];
      const existing = updated.findIndex(i => i.productId === itemId);
      if (existing >= 0) {
        updated[existing].quantity = quantity;
        setGuestCartItems(updated);
        localStorage.setItem('guest_cart', JSON.stringify(updated));
      }
    }
  };

  const applyCoupon = async (couponCode: string) => {
    const cartId = cart?.id || cart?.cartId;
    if (!isAuthenticated || !cartId || !selectedBranch?.id) return;
    setIsLoading(true);
    try {
      await cartService.applyPromotion(
        cartId,
        couponCode,
        selectedBranch.id,
        cart!.totalCartPrice || 0,
        'DELIVERY' // Defaulting to DELIVERY as per prompt/context, might need adjustment if pickup is an option
      );
      toast.success('Coupon applied successfully');
      // Refresh cart
      const updatedCart = await cartService.getCart(cartId);
      setCart(updatedCart);
    } catch (e: any) {
      console.error("Apply coupon failed", e);
      toast.error(e.response?.data?.message || 'Failed to apply coupon');
      throw e; // Re-throw to let component handle specific UI states if needed
    } finally {
      setIsLoading(false);
    }
  };

  const removeCoupon = async () => {
    const cartId = cart?.id || cart?.cartId;
    if (!isAuthenticated || !cartId) return;
    setIsLoading(true);
    try {
      await cartService.removePromotion(cartId);
      toast.success('Coupon removed');
      // Refresh cart
      const updatedCart = await cartService.getCart(cartId);
      setCart(updatedCart);
    } catch (e: any) {
      console.error("Remove coupon failed", e);
      toast.error(e.response?.data?.message || 'Failed to remove coupon');
    } finally {
      setIsLoading(false);
    }
  };



  const checkAvailablePromotions = async () => {
    const cartId = cart?.id || cart?.cartId;
    if (!isAuthenticated || !cartId) return;
    try {
      // Defaulting to DELIVERY as per current flow
      const promos = await cartService.getAvailablePromotions(cartId, 'DELIVERY');
      setAvailablePromotions(promos || []);
    } catch (e) {
      console.error("Failed to fetch available promotions", e);
      // We don't block the UI for this, just log it
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
      applyCoupon,
      removeCoupon,
      availablePromotions,
      checkAvailablePromotions
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
