import {
  CartProductReward,
  CartPromotion,
  ProductRewardScope,
  PRODUCT_REWARD_ITEM_REQUIRED,
} from '@/types/cart';

/** A campaign row that is a repeatable product reward rather than a plain coupon. */
export const getProductReward = (promotion: Pick<CartPromotion, 'productReward'>): CartProductReward | null =>
  promotion.productReward ?? null;

export interface ProductRewardProgress {
  /** Qualifying items bought so far. */
  earned: number;
  /** Items needed for the next reward — the right hand side of "12 / 20". */
  target: number;
  /** Items still missing for the next reward. */
  remaining: number;
  /** 0–100, for the progress bar. */
  percent: number;
  /** Earned but unspent rewards. */
  availableRewards: number;
}

/**
 * Turns the backend counters into what the progress row renders.
 *
 * The next target is derived as `qualifyingQuantity + remainingQuantity` rather
 * than from the threshold: the backend already accounts for rewards that were
 * spent in earlier orders, so 12 bought against a threshold of 10 reports 8
 * remaining and must read "12 / 20", not "12 / 10".
 */
export function resolveProductRewardProgress(reward: CartProductReward | null | undefined): ProductRewardProgress | null {
  if (!reward) return null;

  const earned = Math.max(0, Number(reward.qualifyingQuantity ?? 0));
  const remaining = Math.max(0, Number(reward.remainingQuantity ?? 0));
  const threshold = Math.max(0, Number(reward.productQuantityThreshold ?? 0));
  const availableRewards = Math.max(0, Number(reward.availableRewards ?? 0));

  // `remaining` is 0 on a fully earned reward, which would leave the bar with
  // no scale — fall back to the threshold so it still reads as complete.
  const target = earned + remaining > 0 ? earned + remaining : threshold;
  if (target <= 0) return null;

  return {
    earned,
    target,
    remaining,
    percent: Math.min(100, Math.round((earned / target) * 100)),
    availableRewards,
  };
}

/** The eligible item the customer has to add before the reward can be applied. */
export function resolveRewardTargetName(reward: CartProductReward | null | undefined): string | null {
  if (!reward) return null;
  if (reward.rewardScope === ProductRewardScope.PRODUCT) return reward.rewardProductName ?? null;
  return reward.rewardCategoryName ?? reward.rewardProductName ?? null;
}

/**
 * Deep link to the menu that lands the customer on the reward's fixed product
 * or category, so `PRODUCT_REWARD_ITEM_REQUIRED` has somewhere to send them.
 * `basePath` is the menu route of the current journey (`/` or `/order`).
 */
export function buildRewardMenuHref(
  reward: CartProductReward | null | undefined,
  basePath = '/',
  extraParams?: Record<string, string>,
): string | null {
  if (!reward) return null;

  const params = new URLSearchParams(extraParams);
  if (reward.rewardProductId) {
    params.set('product', reward.rewardProductId);
  } else if (reward.rewardCategoryId) {
    params.set('category', reward.rewardCategoryId);
  } else {
    return null;
  }

  return `${basePath}?${params.toString()}`;
}

/** The campaign is blocked purely because no eligible item is in the cart. */
export const needsRewardItem = (promotion: Pick<CartPromotion, 'applicable' | 'unapplicableReason'>) =>
  !promotion.applicable && promotion.unapplicableReason === PRODUCT_REWARD_ITEM_REQUIRED;
