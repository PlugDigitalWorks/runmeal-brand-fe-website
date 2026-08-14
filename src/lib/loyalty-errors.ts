import i18n from '@/i18n/config';

// Error codes returned by the loyalty promotion endpoints.
// Messages live in i18n under `loyalty.errors.<CODE>`; never parse the
// backend `message` text, only the `code` field.
const LOYALTY_ERROR_CODES = new Set([
  'LOYALTY_PROMOTION_NOT_APPLICABLE',
  'LOYALTY_PROMOTION_NOT_OWNED',
  'LOYALTY_PROMOTION_INACTIVE',
  'LOYALTY_PROMOTIONS_NOT_COMBINABLE',
  'LOYALTY_PROMOTION_NOT_FOUND_ON_CART',
  'LOYALTY_PROMOTION_NO_LONGER_APPLICABLE',
  'LOYALTY_EXTERNAL_PROVIDER_NOT_ACTIVE',
  'LOYALTY_PRODUCT_REWARD_RESERVATION_MISSING',
  'LOYALTY_PRODUCT_REWARD_UNAVAILABLE',
]);

/**
 * The product reward the customer checked out with is gone: its reservation
 * expired, or another order spent it first. Payment must never be retried on
 * these — the cart and the campaign list have to be refetched and the reward
 * applied again by hand.
 */
const PRODUCT_REWARD_CHECKOUT_CODES = new Set([
  'LOYALTY_PRODUCT_REWARD_RESERVATION_MISSING',
  'LOYALTY_PRODUCT_REWARD_UNAVAILABLE',
]);

export const isProductRewardCheckoutError = (code: string | null | undefined) =>
  !!code && PRODUCT_REWARD_CHECKOUT_CODES.has(code);

interface LoyaltyApiErrorLike {
  response?: {
    status?: number;
    data?: {
      code?: string;
      message?: string;
    };
  };
}

export interface ResolvedLoyaltyError {
  code: string | null;
  isLoyaltyError: boolean;
  message: string | null;
}

export function resolveLoyaltyError(error: unknown): ResolvedLoyaltyError {
  const data = (error as LoyaltyApiErrorLike)?.response?.data;
  const code = data?.code ?? null;

  if (code && LOYALTY_ERROR_CODES.has(code)) {
    return { code, isLoyaltyError: true, message: i18n.t(`loyalty.errors.${code}`) };
  }

  return { code, isLoyaltyError: false, message: data?.message ?? null };
}

/**
 * User facing copy for `CartPromotion.unapplicableReason`. Known reason codes get
 * mapped copy; anything else is shown as the backend sent it.
 */
export function resolveUnapplicableReason(reason: string | null | undefined): string | null {
  if (!reason) return null;

  const key = `loyalty.unapplicableReasons.${reason}`;
  const translated = i18n.t(key);
  return translated === key ? reason : translated;
}
