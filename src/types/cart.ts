export interface CartItem {
  id: string;
  productId: string;
  productName: string | null;
  price: number;
  note?: string | null;
  imgUrl: string | null;
  qty: number;
  options?: CartItemOptionGroup[];
  addons?: { name: string; price?: number }[];
}

export interface CartItemOptionGroup {
  type: string;
  groupId: string;
  groupName: string;
  selections: CartItemOptionSelection[];
}

export interface CartItemOptionSelection {
  action: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface Cart {
  id?: string;
  cartId?: string;
  brandId: string;
  branchId: string;
  userId: string;
  totalCartPrice?: number;
  discountAmount?: number;
  finalPrice?: number;
  appliedPromotions?: AppliedPromotion[];
  items?: CartItem[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface AppliedPromotion {
  id: string;
  name: string;
  description?: string | null;
  creditType?: string;
  creditValue?: number;
  externalProvider?: string | null;
}

export interface AvailablePromotion {
  applicable: boolean;
  unapplicableReason?: string | null;
  promotion: {
    id: string;
    name: string;
    description?: string | null;
    couponCode?: string | null;
    creditType?: string;
    creditValue?: number;
    externalProvider?: string | null;
    status?: string;
    raw?: {
      assetDetails?: {
        image?: string | null;
      };
    } & Record<string, unknown>;
  };
}

export const REKONECT_PROVIDER = 'REKONECT';

export function isRekonectPromotion(promotion: { externalProvider?: string | null }) {
  return promotion.externalProvider === REKONECT_PROVIDER;
}

export interface AddItemDto {
  productId: string;
  qty?: number;
  options?: { groupId: string; optionId?: string; optionIds?: string[] }[];
  note?: string;
}

export interface SetQtyDto {
  itemId: string;
  qty: number;
}
