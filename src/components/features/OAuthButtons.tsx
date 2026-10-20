'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { OAuthProvider } from '@/types/auth';

const getErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string } } }).response;
        return response?.data?.message;
    }
    return undefined;
};

/** Apple's logo glyph, as Apple's sign-in button artwork draws it. */
function AppleLogo() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px] fill-current">
            <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
        </svg>
    );
}

interface OAuthButtonsProps {
    /** Register shows "Sign up with …", login "Sign in with … / Continue with …". */
    mode?: 'login' | 'register';
}

/**
 * Google and Apple sign-in. Both leave for the provider's page and come back
 * to /login with a handoff; Apple's button follows Apple's guidelines (black,
 * Apple logo, same size as Google's).
 */
export function OAuthButtons({ mode = 'login' }: OAuthButtonsProps) {
    const { t } = useTranslation();
    const { loginWithOAuth } = useAuth();
    const [pending, setPending] = useState<OAuthProvider | null>(null);

    const start = async (provider: OAuthProvider) => {
        setPending(provider);
        try {
            await loginWithOAuth(provider);
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error) || t(`auth.${provider}StartFailed`));
            setPending(null);
        }
    };

    const googleLabel = mode === 'register' ? t('auth.register.googleSignup') : t('auth.continueWithGoogle');
    const appleLabel = mode === 'register' ? t('auth.register.appleSignup') : t('auth.continueWithApple');

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={() => start('google')}
                disabled={pending !== null}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-zinc-200 rounded-md shadow-sm text-sm font-medium text-zinc-800 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {pending === 'google' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 text-sm font-bold text-zinc-700">
                        G
                    </span>
                )}
                {pending === 'google' ? t('auth.redirecting') : googleLabel}
            </button>
            <button
                type="button"
                onClick={() => start('apple')}
                disabled={pending !== null}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-black rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {pending === 'apple' ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <AppleLogo />}
                {pending === 'apple' ? t('auth.redirecting') : appleLabel}
            </button>
        </div>
    );
}
