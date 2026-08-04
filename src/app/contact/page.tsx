'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AlertCircle, MapPin, UserIcon } from 'lucide-react';

import { ContactForm } from '@/components/features/ContactForm';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useBrand } from '@/context/BrandContext';
import { useUser } from '@/context/UserContext';
import { hasCompleteContactIdentity } from '@/types/contact';

/** Blocking states share one layout so the page never jumps between shapes. */
function ContactNotice({
    icon: Icon,
    title,
    description,
    actionHref,
    actionLabel,
}: {
    icon: typeof AlertCircle;
    title: string;
    description: string;
    actionHref: string;
    actionLabel: string;
}) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-zinc-100 p-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-primary">
                <Icon size={22} />
            </span>
            <h1 className="mt-4 text-lg font-bold text-zinc-800">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
            <Link
                href={actionHref}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
                {actionLabel}
            </Link>
        </div>
    );
}

export default function ContactPage() {
    const { t } = useTranslation();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { user, isLoading: isUserLoading } = useUser();
    const { selectedBranch, isLoading: isBranchLoading } = useBranch();
    const { brand } = useBrand();

    const isLoading = isAuthLoading || (isAuthenticated && isUserLoading) || isBranchLoading;

    const body = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center gap-3 rounded-lg border border-zinc-100 bg-white p-10 text-sm text-zinc-500">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    {t('contact.loading')}
                </div>
            );
        }

        if (!isAuthenticated) {
            return (
                <ContactNotice
                    icon={UserIcon}
                    title={t('contact.authRequired.title')}
                    description={t('contact.authRequired.description')}
                    actionHref="/login"
                    actionLabel={t('contact.authRequired.action')}
                />
            );
        }

        // The API reads name, surname and e-mail off the account and rejects the
        // request when any is blank, so we say that up front instead of letting
        // the user write a message that cannot be delivered.
        if (!hasCompleteContactIdentity(user)) {
            return (
                <ContactNotice
                    icon={AlertCircle}
                    title={t('contact.incompleteProfile.title')}
                    description={t('contact.incompleteProfile.description')}
                    actionHref="/profile"
                    actionLabel={t('contact.incompleteProfile.action')}
                />
            );
        }

        if (!selectedBranch) {
            return (
                <ContactNotice
                    icon={MapPin}
                    title={t('contact.noBranch.title')}
                    description={t('contact.noBranch.description')}
                    actionHref="/"
                    actionLabel={t('contact.noBranch.action')}
                />
            );
        }

        return (
            <ContactForm
                branchId={selectedBranch.id}
                branchName={selectedBranch.name}
                brandId={brand?.brandId}
            />
        );
    };

    return (
        <div className="min-h-screen bg-zinc-50">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
                <p className="mb-4 text-sm text-zinc-500">{t('contact.subtitle')}</p>
                {body()}
            </div>
        </div>
    );
}
