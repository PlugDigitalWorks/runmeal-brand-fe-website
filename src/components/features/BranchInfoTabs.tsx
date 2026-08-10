'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareText } from 'lucide-react';
import { ContactModal } from '@/components/features/ContactModal';
import type { ResolvedBranchDetails } from '@/lib/branch-details';
import type { Branch } from '@/types/branch';

/**
 * Working hours / contact tabs shown next to the branch heading. Shared by the
 * address panel on the storefront and the table panel in a QR journey, so the
 * same branch facts read identically in both.
 */
export function BranchInfoTabs({ branch, details }: { branch: Branch; details: ResolvedBranchDetails }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState<'workingHours' | 'contact'>('workingHours');
    const [isContactOpen, setIsContactOpen] = React.useState(false);

    return (
        <div className="hidden md:block w-auto shrink-0">
            <div className="flex border-b border-zinc-200 mb-2">
                <button
                    onClick={() => setActiveTab('workingHours')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'workingHours' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
                >
                    {t('branch.workingHours')}
                </button>
                <button
                    onClick={() => setActiveTab('contact')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'contact' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
                >
                    {t('contact.title')}
                </button>
            </div>
            <div className="text-xs text-zinc-500 min-h-[3rem]">
                {activeTab === 'workingHours' ? (
                    <>
                        <span className="block font-medium text-zinc-700 mb-1">{t('branch.today')}</span>
                        {details.workingHours
                            || (details.isOpen24Hours ? t('branch.open24Hours') : t('branch.closedToday'))}
                    </>
                ) : (
                    <>
                        <span className="block font-medium text-zinc-700 mb-1">{t('branch.phoneNumber')}</span>
                        {details.phoneNumber || t('branch.notProvided')}
                        <button
                            type="button"
                            onClick={() => setIsContactOpen(true)}
                            className="mt-2 flex items-center gap-1.5 font-medium text-primary hover:underline"
                        >
                            <MessageSquareText size={14} className="shrink-0" />
                            {t('contact.title')}
                        </button>
                    </>
                )}
            </div>

            {isContactOpen && (
                <ContactModal
                    branchId={branch.id}
                    branchName={branch.name}
                    onClose={() => setIsContactOpen(false)}
                />
            )}
        </div>
    );
}

/** The contact entry point for mobile, where the tabs above are hidden. */
export function BranchContactLink({ branch }: { branch: Branch }) {
    const { t } = useTranslation();
    const [isContactOpen, setIsContactOpen] = React.useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="inline-flex items-center gap-1.5 pt-1 font-medium text-primary hover:underline md:hidden"
            >
                <MessageSquareText size={14} className="shrink-0" />
                {t('contact.title')}
            </button>

            {isContactOpen && (
                <ContactModal
                    branchId={branch.id}
                    branchName={branch.name}
                    onClose={() => setIsContactOpen(false)}
                />
            )}
        </>
    );
}
