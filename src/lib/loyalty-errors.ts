import i18n from '@/i18n/config';

// Error codes returned by the loyalty/external-promotion endpoints.
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
]);

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
