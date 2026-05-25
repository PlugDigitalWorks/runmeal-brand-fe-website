'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface GoogleAuthButtonProps {
    label?: string;
}

const getErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string } } }).response;
        return response?.data?.message;
    }
    return undefined;
};

export function GoogleAuthButton({ label = 'Continue with Google' }: GoogleAuthButtonProps) {
    const { loginWithGoogle } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        try {
            await loginWithGoogle();
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error) || 'Google login could not be started.');
            setIsLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-zinc-200 rounded-md shadow-sm text-sm font-medium text-zinc-800 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 text-sm font-bold text-zinc-700">
                    G
                </span>
            )}
            {isLoading ? 'Redirecting...' : label}
        </button>
    );
}
