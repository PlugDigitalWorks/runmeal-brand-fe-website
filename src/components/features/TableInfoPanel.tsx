'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CreditCard, QrCode, ShoppingBag, Utensils, Wallet } from 'lucide-react';
import { useBranch } from '@/context/BranchContext';
import { BranchContactLink, BranchInfoTabs } from '@/components/features/BranchInfoTabs';
import { isPickupAvailable, resolveBranchDetails } from '@/lib/branch-details';
import type { QrOrderContext } from '@/types/table';

/**
 * The table context panel above the menu — the QR-journey counterpart of
 * `BranchSelector`. It occupies the same slot but has nothing to choose: the
 * branch and table both come from the scanned token.
 *
 * `tableLabel` is display only; `tableId` is what identifies the table at
 * checkout, and it is never taken from anywhere but the resolved journey.
 */
export function TableInfoPanel({ journey }: { journey: QrOrderContext }) {
    const { t } = useTranslation();
    const { selectedBranch, isLoading } = useBranch();

    const branchDetails = React.useMemo(() => resolveBranchDetails(selectedBranch), [selectedBranch]);
    const { payNow, payLater } = journey.checkoutOptions;
    const canOrderToTable = payNow || payLater;
    const pickupAvailable = isPickupAvailable(selectedBranch);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-100 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="flex-1 w-full min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-primary">
                        <QrCode size={13} className="shrink-0" />
                        {t('table.panel.badge')}
                    </span>

                    <h2 className="mt-3 text-2xl font-bold text-zinc-800 break-words">{journey.tableLabel}</h2>

                    <p className="mt-1 text-sm text-zinc-500">
                        {selectedBranch?.name
                            ? t('table.panel.branchLine', { branch: selectedBranch.name })
                            : isLoading
                                ? t('branch.loading')
                                : t('table.panel.branchUnknown')}
                    </p>

                    {canOrderToTable ? (
                        <>
                            <p className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
                                <Utensils size={15} className="shrink-0 text-primary" />
                                {t('table.panel.servedAtTable', { table: journey.tableLabel })}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                {payNow && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                                        <CreditCard size={13} className="shrink-0" />
                                        {t('table.checkout.payNow')}
                                    </span>
                                )}
                                {payLater && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                                        <Wallet size={13} className="shrink-0" />
                                        {t('table.checkout.payLater')}
                                    </span>
                                )}
                                {pickupAvailable && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                                        <ShoppingBag size={13} className="shrink-0" />
                                        {t('table.checkout.pickup')}
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span>
                                {pickupAvailable
                                    ? t('table.panel.tableClosedPickupOnly')
                                    : t('table.panel.tableClosed')}
                            </span>
                        </div>
                    )}

                    {selectedBranch && branchDetails && <BranchContactLink branch={selectedBranch} />}
                </div>

                {selectedBranch && branchDetails && (
                    <BranchInfoTabs branch={selectedBranch} details={branchDetails} />
                )}
            </div>
        </div>
    );
}
