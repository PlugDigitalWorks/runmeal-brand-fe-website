'use client';

import { useAuth } from '@/context/AuthContext';
import { useTable } from '@/context/TableContext';
import { QrCode, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { RUNMEAL_LOGO } from '@/lib/constants';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { HeaderNavigation } from '@/components/layout/HeaderNavigation';

export function Header() {
    const { user, isAuthenticated, isGuest, logout } = useAuth();
    const { isTableMode, journey } = useTable();
    const { t } = useTranslation();

    // A QR guest is technically authenticated (throwaway CUSTOMER account), but
    // has no name, no profile and nothing to log out of — treat them as a
    // visitor and offer the real sign-in instead.
    const showAccount = isAuthenticated && !!user && !isGuest;

    return (
        <header className="bg-white text-zinc-900 border-b border-zinc-100 sticky top-0 z-50">
            <div className="container mx-auto flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
                <div className="flex min-w-0 shrink items-center gap-3 md:gap-8">
                    {/* Logo */}
                    <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90">
                        <Image
                            src={RUNMEAL_LOGO}
                            alt="Runmeal"
                            width={120}
                            height={32}
                            className="h-7 w-auto max-[360px]:h-6 sm:h-8"
                            priority
                        />
                    </Link>

                    <HeaderNavigation />
                </div>

                {/* Right Actions */}
                <div className="flex min-w-0 shrink items-center gap-1.5 sm:gap-4">
                    {isTableMode && journey && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-primary">
                            <QrCode size={13} className="shrink-0" />
                            {journey.tableLabel}
                        </span>
                    )}
                    {showAccount ? (
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-4">
                            <Link href="/profile" className="flex min-w-0 items-center gap-1 text-xs font-medium text-zinc-700 transition-colors hover:text-primary sm:gap-2 sm:text-sm">
                                <span className="max-w-24 truncate whitespace-nowrap max-[360px]:max-w-14 sm:max-w-48">
                                    {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                                </span>
                                <User size={15} className="shrink-0" />
                            </Link>
                            <button
                                onClick={() => logout()}
                                className="shrink-0 whitespace-nowrap rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-900 transition-colors hover:bg-zinc-200 sm:px-3 sm:text-sm"
                            >
                                {t('header.logout')}
                            </button>
                            <LanguageSwitcher />
                        </div>
                    ) : (
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                            <Link href="/login" className="shrink-0 whitespace-nowrap rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm">
                                {t('header.login')}
                            </Link>
                            <Link href="/register" className="shrink-0 whitespace-nowrap rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-primary hover:text-primary sm:px-4 sm:py-2 sm:text-sm">
                                {t('header.register')}
                            </Link>
                            <LanguageSwitcher />
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
