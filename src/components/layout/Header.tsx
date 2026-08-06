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
            <div className="container mx-auto flex justify-between items-center py-4">
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
                        <Image
                            src={RUNMEAL_LOGO}
                            alt="Runmeal"
                            width={120}
                            height={32}
                            className="h-8 w-auto"
                            priority
                        />
                    </Link>

                    <HeaderNavigation />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {isTableMode && journey && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-primary">
                            <QrCode size={13} className="shrink-0" />
                            {journey.tableLabel}
                        </span>
                    )}
                    {showAccount ? (
                        <div className="flex items-center gap-4">
                            <Link href="/profile" className="text-zinc-700 font-medium flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                                {t('header.hello', { name: `${user.firstName} ${user.lastName}` })}
                                <User size={16} />
                            </Link>
                            <button
                                onClick={() => logout()}
                                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1 rounded text-sm transition-colors"
                            >
                                {t('header.logout')}
                            </button>
                            <LanguageSwitcher />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/login" className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-md font-medium transition-opacity shadow-sm">
                                {t('header.login')}
                            </Link>
                            <Link href="/register" className="border border-zinc-200 hover:border-primary hover:text-primary text-zinc-700 px-4 py-2 rounded-md font-medium transition-colors">
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
