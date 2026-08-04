'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AlertCircle, UserIcon, X } from 'lucide-react';

import { ContactForm } from '@/components/features/ContactForm';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { useUser } from '@/context/UserContext';
import { hasCompleteContactIdentity } from '@/types/contact';

interface ContactModalProps {
    branchId: string;
    branchName: string;
    onClose: () => void;
}

/** Shown instead of the form when the account cannot send a request yet. */
function ContactNotice({
    icon: Icon,
    title,
    description,
    actionHref,
    actionLabel,
    onClose,
}: {
    icon: typeof AlertCircle;
    title: string;
    description: string;
    actionHref: string;
    actionLabel: string;
    onClose: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="relative rounded-lg bg-white p-6 text-center shadow-xl">
            <button
                type="button"
                onClick={onClose}
                aria-label={t('contact.close')}
                className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
                <X size={18} />
            </button>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-primary">
                <Icon size={22} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-zinc-800">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
            <Link
                href={actionHref}
                onClick={onClose}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
                {actionLabel}
            </Link>
        </div>
    );
}

export function ContactModal({ branchId, branchName, onClose }: ContactModalProps) {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const { user } = useUser();
    const { brand } = useBrand();

    // Escape closes it, and the page behind must not scroll while it is open.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    const body = () => {
        if (!isAuthenticated) {
            return (
                <ContactNotice
                    icon={UserIcon}
                    title={t('contact.authRequired.title')}
                    description={t('contact.authRequired.description')}
                    actionHref="/login"
                    actionLabel={t('contact.authRequired.action')}
                    onClose={onClose}
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
                    onClose={onClose}
                />
            );
        }

        return (
            <ContactForm
                branchId={branchId}
                branchName={branchName}
                brandId={brand?.brandId}
                onClose={onClose}
            />
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={t('contact.title')}
        >
            <div
                className="max-h-[90vh] w-full max-w-md overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
            >
                {body()}
            </div>
        </div>
    );
}
