'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Gift } from 'lucide-react';
import { CartItem, CartProductReward } from '@/types/cart';
import {
    buildRewardMenuHref,
    needsRewardItem,
    resolveProductRewardProgress,
    resolveRewardTargetName,
} from '@/lib/loyalty-rewards';
import { formatCurrency } from '@/lib/utils';

interface ProductRewardProgressProps {
    reward: CartProductReward;
    /** The campaign is applied to the cart right now. */
    isApplied: boolean;
    applicable: boolean;
    unapplicableReason: string | null;
    /** Cart lines, to name the one the applied reward landed on. */
    cartItems: CartItem[];
    /** Menu route of the current journey, for the "add an eligible item" link. */
    menuHref?: string;
}

/**
 * The repeatable product reward panel: how far the customer is toward the next
 * free item, what they can redeem now, and — once applied — which cart line the
 * backend spent it on.
 *
 * Progress renders even when nothing is redeemable yet; that is the whole point
 * of the campaign row for a customer who has bought 3 of 10 coffees.
 */
export function ProductRewardProgress({
    reward,
    isApplied,
    applicable,
    unapplicableReason,
    cartItems,
    menuHref = '/',
}: ProductRewardProgressProps) {
    const { t } = useTranslation();
    const progress = resolveProductRewardProgress(reward);
    const targetName = resolveRewardTargetName(reward);
    const appliedItem = reward.appliedCartItemId
        ? cartItems.find((item) => item.id === reward.appliedCartItemId)
        : undefined;
    const appliedAmount = Number(reward.appliedAmount ?? 0);
    const availableRewards = progress?.availableRewards ?? 0;
    // `PRODUCT_REWARD_ITEM_REQUIRED` is the only reason the customer can act on:
    // the reward is earned, the cart just has nothing eligible in it yet.
    // `PRODUCT_REWARD_NOT_EARNED` gets progress and a disabled Apply, no link.
    const itemHref = !isApplied && needsRewardItem({ applicable, unapplicableReason })
        ? buildRewardMenuHref(reward, menuHref)
        : null;

    return (
        <div className="mt-2 space-y-2">
            {progress && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-700">
                        <span>
                            {targetName
                                ? t('loyalty.productReward.scopeLabel', { name: targetName })
                                : t('loyalty.productReward.label')}
                        </span>
                        <span className="tabular-nums">
                            {t('loyalty.productReward.count', {
                                earned: progress.earned,
                                target: progress.target,
                            })}
                        </span>
                    </div>
                    <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"
                        role="progressbar"
                        aria-valuenow={progress.earned}
                        aria-valuemin={0}
                        aria-valuemax={progress.target}
                    >
                        <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                    <p className="text-xs text-zinc-500">
                        {progress.remaining > 0
                            ? t('loyalty.productReward.remaining', { count: progress.remaining })
                            : t('loyalty.productReward.ready')}
                    </p>
                </div>
            )}

            {!isApplied && availableRewards > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                    <Gift size={13} className="shrink-0" />
                    {t('loyalty.productReward.available', { count: availableRewards })}
                </p>
            )}

            {isApplied && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                    <Gift size={13} className="shrink-0" />
                    {appliedItem?.productName
                        ? t('loyalty.productReward.appliedTo', { name: appliedItem.productName })
                        : t('loyalty.productReward.applied')}
                    {appliedAmount > 0 ? ` · ${formatCurrency(-appliedAmount)}` : ''}
                </p>
            )}

            {reward.basePriceOnly && (
                <p className="text-xs text-zinc-500">{t('loyalty.productReward.basePriceOnly')}</p>
            )}

            {itemHref && (
                <Link
                    href={itemHref}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                    {targetName
                        ? t('loyalty.productReward.addItemNamed', { name: targetName })
                        : t('loyalty.productReward.addItem')}
                    <ArrowRight size={12} className="shrink-0" />
                </Link>
            )}
        </div>
    );
}
