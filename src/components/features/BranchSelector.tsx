"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBranch } from '@/context/BranchContext';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { BranchContactLink, BranchInfoTabs } from '@/components/features/BranchInfoTabs';
import { Money } from '@/components/ui/Money';
import {
    branchCanDeliver,
    hasPickupOrderType,
    isBranchSelectable,
    resolveBranchDetails,
} from '@/lib/branch-details';
import type { Branch, BrandBranch } from '@/types/branch';

/** Branches shown as cards; the rest are picked from the dropdown. */
const MAX_BRANCH_CARDS = 3;

type ListedBranch = Branch | BrandBranch;

function formatDistance(meters: number, language: string) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    const km = new Intl.NumberFormat(language.startsWith('en') ? 'en-US' : 'tr-TR', { maximumFractionDigits: 1 })
        .format(meters / 1000);
    return `${km} km`;
}

/** Name, address, distance and delivery note of one branch; shared by the cards and the dropdown rows. */
function BranchSummary({ branch }: { branch: ListedBranch }) {
    const { t, i18n } = useTranslation();
    const canDeliver = branchCanDeliver(branch);
    const distance = branch.distanceM;

    return (
        <div className="min-w-0">
            <div className="font-medium text-zinc-800 truncate">{branch.name}</div>
            {branch.addressText && <div className="text-xs text-zinc-400 mt-0.5 truncate">{branch.addressText}</div>}
            {typeof distance === 'number' && (
                <div className="flex items-center gap-1 text-[11px] text-orange-500 mt-1">
                    <MapPin size={11} /> {formatDistance(distance, i18n.resolvedLanguage || i18n.language)}
                </div>
            )}
            {canDeliver === false && (
                <div className="text-[11px] mt-1">
                    <span className="font-medium text-red-500">{t('branch.noDeliveryHere')}</span>
                    {hasPickupOrderType(branch) && <span className="text-zinc-500"> · {t('branch.pickupAvailable')}</span>}
                </div>
            )}
        </div>
    );
}

/**
 * The branch panel that sits above the menu on the storefront: every open
 * branch of the brand, the first few as cards and the rest in a dropdown.
 * A QR journey renders `TableInfoPanel` in the same slot instead — the branch
 * there comes from the scanned table, so there is nothing to pick.
 */
export function BranchSelector() {
    const { t } = useTranslation();
    const { selectedBranch, branches, selectBranch, isLoading } = useBranch();
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const branchDetails = React.useMemo(() => resolveBranchDetails(selectedBranch), [selectedBranch]);
    const cardBranches = branches.slice(0, MAX_BRANCH_CARDS);
    const hasMore = branches.length > MAX_BRANCH_CARDS;

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const pick = (branch: ListedBranch) => {
        if (!isBranchSelectable(branch)) return;
        selectBranch(branch);
        setIsDropdownOpen(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-100 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="flex-1 w-full min-w-0">
                    <h2 className="text-2xl font-bold text-zinc-800 mb-3">
                        {selectedBranch ? selectedBranch.name : t('branch.availableBranches')}
                    </h2>

                    {isLoading && branches.length === 0 ? (
                        <p className="text-sm text-zinc-500">{t('branch.loading')}</p>
                    ) : branches.length === 0 ? (
                        <p className="text-sm text-zinc-500">{t('branch.noBranches')}</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {cardBranches.map((branch) => {
                                    const isSelected = selectedBranch?.id === branch.id;
                                    const selectable = isBranchSelectable(branch);
                                    return (
                                        <button
                                            key={branch.id}
                                            type="button"
                                            onClick={() => pick(branch)}
                                            disabled={!selectable}
                                            aria-pressed={isSelected}
                                            className={`relative text-left rounded-lg border p-3 text-sm transition-colors ${
                                                isSelected
                                                    ? 'border-primary bg-orange-50'
                                                    : 'border-zinc-200 hover:border-primary/60 hover:bg-orange-50/40'
                                            } ${selectable ? '' : 'cursor-not-allowed opacity-50 hover:border-zinc-200 hover:bg-transparent'}`}
                                        >
                                            {isSelected && <Check size={14} className="absolute right-2 top-2 text-primary" />}
                                            <BranchSummary branch={branch} />
                                        </button>
                                    );
                                })}
                            </div>

                            {hasMore && (
                                <div className="relative mt-3 inline-block" ref={dropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen((open) => !open)}
                                        className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                                    >
                                        {t('branch.allBranches', { count: branches.length })}
                                        <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-4rem)] bg-white border border-zinc-200 rounded-lg shadow-xl z-10 max-h-72 overflow-y-auto">
                                            {branches.map((branch) => {
                                                const selectable = isBranchSelectable(branch);
                                                return (
                                                    <button
                                                        key={branch.id}
                                                        type="button"
                                                        onClick={() => pick(branch)}
                                                        disabled={!selectable}
                                                        className={`w-full text-left px-4 py-3 text-sm border-b border-zinc-50 last:border-0 ${
                                                            selectedBranch?.id === branch.id ? 'bg-orange-50' : 'hover:bg-orange-50'
                                                        } ${selectable ? '' : 'cursor-not-allowed opacity-50 hover:bg-transparent'}`}
                                                    >
                                                        <BranchSummary branch={branch} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {selectedBranch && branchDetails && (
                        <div className="mt-4 text-sm text-zinc-500 space-y-1">
                            <p>{t('branch.minimumOrder')}: <Money value={branchDetails.minimumDeliveryAmount} /></p>
                            <p>
                                {t('branch.payment')}:{' '}
                                {branchDetails.paymentMethodKeys.map(key => t(`branch.paymentMethods.${key}`)).join(', ')}
                            </p>
                            <p>{branchDetails.orderTypeKeys.map(key => t(`branch.orderTypes.${key}`)).join(', ')}</p>
                            {/* The Contact tab above is desktop only, so mobile needs its own way in. */}
                            <BranchContactLink branch={selectedBranch} />
                        </div>
                    )}
                </div>

                {selectedBranch && branchDetails && (
                    <BranchInfoTabs branch={selectedBranch} details={branchDetails} />
                )}
            </div>
        </div>
    );
}
