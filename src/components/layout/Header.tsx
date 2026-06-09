'use client';

import { useAuth } from '@/context/AuthContext';
import { User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { RUNMEAL_LOGO } from '@/lib/constants';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export function Header() {
    const { user, isAuthenticated, logout } = useAuth();
    const { t } = useTranslation();

    return (
        <header className="bg-white text-zinc-900 border-b border-zinc-100 sticky top-0 z-50">
            <div className="container mx-auto flex justify-between items-center py-4">
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

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {isAuthenticated && user ? (
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
