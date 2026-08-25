/**
 * Mock stamp-card ("10 kahveye 1 hediye") data.
 *
 * The backend endpoint does not exist yet. Everything below is shaped the way
 * we expect the real payload to look, so swapping `fetchLoyaltyStampCards` for
 * a `loyaltyService` call later is the only change the UI should need.
 */

export interface LoyaltyStampCard {
  id: string;
  /** Branch/brand running the campaign. */
  merchantName: string;
  /** What the customer has to buy — "Filtre Kahve". */
  productName: string;
  /** What they get for free once the card fills up. */
  rewardName: string;
  /** Stamps needed for one reward. */
  target: number;
  /** Stamps collected toward the current card. */
  earned: number;
  /** Earned but not yet redeemed rewards. */
  availableRewards: number;
  /** ISO date, or null when the campaign has no end. */
  expiresAt: string | null;
  /** Accent used for the card face; falls back to the theme primary. */
  accent?: string;
}

export const MOCK_LOYALTY_CARDS: LoyaltyStampCard[] = [
  {
    id: 'card-coffee-10',
    merchantName: 'Runmeal Coffee',
    productName: 'Filtre Kahve',
    rewardName: '1 Hediye Kahve',
    target: 10,
    earned: 10,
    availableRewards: 1,
    expiresAt: '2026-12-31',
  },
  {
    id: 'card-bagel-5',
    merchantName: 'Runmeal Bakery',
    productName: 'Simit & Poğaça',
    rewardName: '1 Hediye Poğaça',
    target: 5,
    earned: 3,
    availableRewards: 0,
    expiresAt: null,
  },
];

/**
 * What the cashier scans. It is the customer's own id and never changes, so it
 * is rendered once for the whole wallet rather than per card.
 */
export const buildMemberQrPayload = (userId: string) => userId;

/** Stand-in for `GET /loyalty/stamp-cards`; the delay keeps the loading state honest. */
export function fetchLoyaltyStampCards(): Promise<LoyaltyStampCard[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_LOYALTY_CARDS.map((card) => ({ ...card }))), 400);
  });
}

export interface StampCardProgress {
  earned: number;
  target: number;
  remaining: number;
  /** 0–100, for the bar. */
  percent: number;
  isComplete: boolean;
}

export function resolveStampProgress(card: LoyaltyStampCard): StampCardProgress {
  const target = Math.max(1, card.target);
  const earned = Math.max(0, Math.min(card.earned, target));
  const remaining = Math.max(0, target - earned);

  return {
    earned,
    target,
    remaining,
    percent: Math.round((earned / target) * 100),
    isComplete: remaining === 0 || card.availableRewards > 0,
  };
}
