'use client';

import { useTranslation } from 'react-i18next';
import { resolveRewardTargetName } from '@/lib/loyalty-rewards';
import { OrderDetails, toPromotionSnapshots } from '@/services/order.service';
import { Money } from '@/components/ui/Money';

/**
 * The internal promotions the order was placed with, as the order recorded
 * them. A product reward names the free item it paid for; the campaign itself
 * may no longer exist, so nothing here is looked up live.
 */
export function OrderPromotionSnapshots({
    snapshot,
    currency,
}: {
    snapshot: OrderDetails['internalPromotionSnapshot'];
    currency?: string | null;
}) {
    const { t } = useTranslation();
    const snapshots = toPromotionSnapshots(snapshot);
    if (snapshots.length === 0) return null;

    return (
        <div className="space-y-1.5 pt-2">
            {snapshots.map((entry, index) => {
                const reward = entry.productReward;
                const rewardName = resolveRewardTargetName(reward);
                const amount = Number(reward?.appliedAmount ?? entry.discountAmount ?? 0);

                return (
                    <div
                        key={entry.promotionCode || index}
                        className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700"
                    >
                        <div className="min-w-0">
                            <p className="font-semibold break-words">
                                {entry.name || entry.promotionCode || t('loyalty.campaignsTitle')}
                            </p>
                            {reward && (
                                <p className="break-words">
                                    {rewardName
                                        ? t('loyalty.productReward.orderSummaryNamed', { name: rewardName })
                                        : t('loyalty.productReward.orderSummary')}
                                </p>
                            )}
                        </div>
                        {amount > 0 && (
                            <span className="shrink-0 font-semibold whitespace-nowrap">
                                <Money value={-amount} currency={currency} />
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
