import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth'; // Reusing ApiResponse wrapper
import {
  AddItemDto,
  ApplyPromotionInput,
  Cart,
  CartLoyaltyWallet,
  CartPromotion,
  RemovePromotionInput,
  SetQtyDto,
} from '@/types/cart';

type LoyaltyWalletResponse = CartLoyaltyWallet | ApiResponse<CartLoyaltyWallet>;

/**
 * Cart requests carry the branch they operate on. The backend does not gate
 * these routes on it today, but it is part of the protected-request contract
 * and is what a QR journey uses to stay pinned to the scanned table's branch.
 */
const branchHeaders = (branchId?: string | null) =>
  branchId ? { headers: { 'x-branch-id': branchId } } : {};

export const cartService = {
  async getAllCarts(branchId?: string | null) {
    const response = await api.get<ApiResponse<Cart[]>>('/carts', branchHeaders(branchId));
    return response.data.data;
  },

  async getCart(cartId: string, branchId?: string | null) {
    const response = await api.get<ApiResponse<Cart>>(`/carts/${cartId}`, branchHeaders(branchId));
    return response.data.data;
  },

  async addItem(data: AddItemDto, branchId?: string) {
    const response = await api.post<ApiResponse<Cart>>('/carts/items', data, branchHeaders(branchId));
    return response.data.data;
  },

  async setQty(data: SetQtyDto, branchId?: string) {
    const response = await api.patch<ApiResponse<Cart>>('/carts/items/qty', data, branchHeaders(branchId));
    return response.data.data;
  },

  async removeItem(itemId: string, branchId?: string) {
    const response = await api.delete<ApiResponse<Cart | { message: string }>>(
      `/carts/items/${itemId}`,
      branchHeaders(branchId),
    );
    return response.data.data;
  },

  /**
   * Balance the cart's branch lets the user spend, resolved by its loyalty
   * provider — the account-wide Runmeal credit balance can differ from it.
   */
  async getLoyaltyWallet(cartId: string, branchId?: string | null) {
    const response = await api.get<LoyaltyWalletResponse>(
      `/carts/${cartId}/loyalty/wallet`,
      branchHeaders(branchId),
    );
    const body = response.data;
    // The endpoint answers unwrapped; tolerate the standard { data } envelope too.
    const wallet = body && 'data' in body ? body.data : body;
    return (wallet as CartLoyaltyWallet | undefined) ?? null;
  },

  /** Internal Runmeal coupons and Rekonect campaigns, in one list. */
  async getAvailablePromotions(cartId: string, orderType: string = 'DELIVERY', branchId?: string | null) {
    const response = await api.get<ApiResponse<CartPromotion[]>>(`/carts/${cartId}/promotions/available`, {
      ...branchHeaders(branchId),
      params: { orderType }
    });
    return response.data.data ?? [];
  },

  /** Applies one promotion of either provider. The response is the full, re-priced cart. */
  async applyPromotion(
    cartId: string,
    input: ApplyPromotionInput,
    orderType: string = 'DELIVERY',
    branchId?: string | null,
  ) {
    const response = await api.post<ApiResponse<Cart>>(`/carts/${cartId}/promotions/apply`, {
      type: input.type,
      promotionCode: input.promotionCode,
      orderType
    }, branchHeaders(branchId));
    return response.data.data;
  },

  /**
   * Removes one promotion, or every promotion of that provider when
   * `promotionCode` is omitted. The response is the full, re-priced cart.
   */
  async removePromotion(cartId: string, input: RemovePromotionInput, branchId?: string | null) {
    const response = await api.post<ApiResponse<Cart>>(`/carts/${cartId}/promotions/remove`, {
      type: input.type,
      ...(input.promotionCode ? { promotionCode: input.promotionCode } : {})
    }, branchHeaders(branchId));
    return response.data.data;
  },

  async clearCart(cartId: string, branchId?: string | null) {
    const response = await api.delete<ApiResponse<{ message: string }>>('/carts', {
      ...branchHeaders(branchId),
      data: { cartId }
    });
    return response.data.data;
  },

  async deactivateCart(cartId: string, branchId?: string | null) {
    const response = await api.patch<ApiResponse<{ message: string }>>(
      '/carts/deactivate',
      { cartId },
      branchHeaders(branchId),
    );
    return response.data.data;
  },

  async getCartItems(cartId: string, branchId?: string | null) {
    const response = await api.get<ApiResponse<unknown[]>>('/carts/items', {
      ...branchHeaders(branchId),
      params: { cartId }
    });
    return response.data.data;
  }
};
