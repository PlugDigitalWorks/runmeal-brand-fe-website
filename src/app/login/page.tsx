'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, User, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { GoogleAuthButton } from '@/components/features/GoogleAuthButton';
import { RecaptchaWidget } from '@/components/features/RecaptchaWidget';

type LoginFormValues = {
    email: string;
    password: string;
};

export default function LoginPage() {
    const { login, completeGoogleLogin } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();
    const loginSchema = z.object({
        email: z.string().email(t('auth.validation.emailInvalid')),
        password: z.string().min(6, t('auth.validation.passwordMin')),
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
    const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
    const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
    const handledGoogleCallbackRef = useRef(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const getErrorMessage = (error: unknown) => {
        if (typeof error === 'object' && error !== null && 'response' in error) {
            const response = (error as { response?: { data?: { message?: string } } }).response;
            return response?.data?.message;
        }
        return undefined;
    };

    const onSubmit = async (data: LoginFormValues) => {
        if (isRecaptchaEnabled && !recaptchaToken) {
            toast.error(t('auth.validation.securityCheck'));
            return;
        }

        setIsLoading(true);
        try {
            await login({ ...data, recaptchaToken: recaptchaToken ?? undefined });
            toast.success(t('auth.login.success'));
            router.push('/');
        } catch (error) {
            console.error(error);
            setRecaptchaToken(null);
            setRecaptchaResetKey((key) => key + 1);
            toast.error(getErrorMessage(error) || t('auth.login.error'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (handledGoogleCallbackRef.current) return;

        const params = new URLSearchParams(window.location.search);
        const authStatus = params.get('auth');
        if (!authStatus) return;

        handledGoogleCallbackRef.current = true;
        const reason = params.get('reason');
        window.history.replaceState(null, '', '/login');

        if (authStatus === 'success') {
            setIsLoading(true);
            completeGoogleLogin()
                .then(() => {
                    toast.success(t('auth.login.googleSuccess'));
                    router.push('/');
                })
                .catch((error) => {
                    console.error(error);
                    toast.error(t('auth.login.googleRestoreError'));
                })
                .finally(() => setIsLoading(false));
            return;
        }

        toast.error(reason || t('auth.login.googleFailed'));
    }, [completeGoogleLogin, router, t]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white px-4">
            <div className="w-full max-w-md space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                        <User className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                        {t('auth.login.title')}
                    </h1>
                    <p className="text-zinc-500">
                        {t('auth.login.subtitle')}
                    </p>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <GoogleAuthButton />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-zinc-500">
                                {t('auth.login.orEmail')}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700" htmlFor="email">
                                {t('auth.email')}
                            </label>
                            <input
                                {...register('email')}
                                id="email"
                                type="email"
                                placeholder={t('auth.emailPlaceholder')}
                                className={`w-full px-3 py-2 border rounded-md shadow-sm outline-none transition-all text-zinc-900 placeholder:text-zinc-400 ${errors.email
                                        ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                        : 'border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
                                    }`}
                            />
                            {errors.email && (
                                <p className="text-xs text-red-500">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-zinc-700" htmlFor="password">
                                    {t('auth.password')}
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                    {t('auth.login.forgot')}
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    {...register('password')}
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm outline-none transition-all text-zinc-900 placeholder:text-zinc-400 pr-10 ${errors.password
                                            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                            : 'border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-red-500">{errors.password.message}</p>
                            )}
                        </div>
                    </div>

                    <RecaptchaWidget
                        onTokenChange={setRecaptchaToken}
                        resetKey={recaptchaResetKey}
                    />

                    <button
                        type="submit"
                        disabled={isLoading || (isRecaptchaEnabled && !recaptchaToken)}
                        className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('auth.login.submitting')}
                            </>
                        ) : (
                            t('auth.login.submit')
                        )}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-zinc-500">
                                {t('auth.login.noAccount')}
                            </span>
                        </div>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/register"
                            className="font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                            {t('auth.login.createAccount')}
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
