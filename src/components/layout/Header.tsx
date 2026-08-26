'use client';

import { useAuth } from '@/context/AuthContext';
import { useTable } from '@/context/TableContext';
import { Gift, LogOut, QrCode, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { RUNMEAL_LOGO } from '@/lib/constants';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { HeaderNavigation } from '@/components/layout/HeaderNavigation';
import { useStampAvailability } from '@/hooks/useLoyaltyStamps';

export function Header() {
    const { user, isAuthenticated, isGuest, logout } = useAuth();
    const { isTableMode, journey } = useTable();
    const { t } = useTranslation();

    // A QR guest is technically authenticated (throwaway CUSTOMER account), but
    // has no name, no profile and nothing to log out of — treat them as a
    // visitor and offer the real sign-in instead.
    const showAccount = isAuthenticated && !!user && !isGuest;
    // Brands that do not run stamp loyalty get no rewards entry point at all.
    const { isStampActive } = useStampAvailability(showAccount);

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
                        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                            {isStampActive && (
                                <Link
                                    href="/rewards"
                                    aria-label={t('rewards.tab')}
                                    title={t('rewards.tab')}
                                    className="shrink-0 rounded-full p-2 text-primary transition-colors hover:bg-primary/10"
                                >
                                    <Gift size={18} />
                                </Link>
                            )}
                            <Link
                                href="/profile"
                                aria-label={t('header.account')}
                                title={t('header.account')}
                                className="shrink-0 rounded-full p-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-primary"
                            >
                                <User size={18} />
                            </Link>
                            <button
                                onClick={() => logout()}
                                aria-label={t('header.logout')}
                                title={t('header.logout')}
                                className="shrink-0 rounded-full p-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-destructive"
                            >
                                <LogOut size={18} />
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
