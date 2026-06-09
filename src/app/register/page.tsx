'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { GoogleAuthButton } from '@/components/features/GoogleAuthButton';

type RegisterFormValues = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
};

export default function RegisterPage() {
    const { register: registerUser } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();
    const registerSchema = z.object({
        firstName: z.string().min(2, t('auth.validation.firstNameMin')),
        lastName: z.string().min(2, t('auth.validation.lastNameMin')),
        email: z.string().email(t('auth.validation.emailInvalid')),
        password: z.string().min(6, t('auth.validation.passwordMin')),
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormValues) => {
        setIsLoading(true);
        try {
            await registerUser(data);
            toast.success(t('auth.register.success'));
            router.push('/login');
        } catch (error) {
            console.error(error);
            toast.error(t('auth.register.error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white px-4">
            <div className="w-full max-w-md space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                        <UserPlus className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                        {t('auth.register.title')}
                    </h1>
                    <p className="text-zinc-500">
                        {t('auth.register.subtitle')}
                    </p>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <GoogleAuthButton label={t('auth.register.googleSignup')} />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-zinc-500">
                                {t('auth.register.orEmail')}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700" htmlFor="firstName">
                                    {t('auth.register.firstName')}
                                </label>
                                <input
                                    {...register('firstName')}
                                    id="firstName"
                                    type="text"
                                    placeholder={t('auth.register.firstNamePlaceholder')}
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm outline-none transition-all text-zinc-900 placeholder:text-zinc-400 ${errors.firstName
                                        ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                        : 'border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
                                        }`}
                                />
                                {errors.firstName && (
                                    <p className="text-xs text-red-500">{errors.firstName.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700" htmlFor="lastName">
                                    {t('auth.register.lastName')}
                                </label>
                                <input
                                    {...register('lastName')}
                                    id="lastName"
                                    type="text"
                                    placeholder={t('auth.register.lastNamePlaceholder')}
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm outline-none transition-all text-zinc-900 placeholder:text-zinc-400 ${errors.lastName
                                        ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                        : 'border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
                                        }`}
                                />
                                {errors.lastName && (
                                    <p className="text-xs text-red-500">{errors.lastName.message}</p>
                                )}
                            </div>
                        </div>

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
                            <label className="text-sm font-medium text-zinc-700" htmlFor="password">
                                {t('auth.password')}
                            </label>
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

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('auth.register.submitting')}
                            </>
                        ) : (
                            t('auth.register.submit')
                        )}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-zinc-500">
                                {t('auth.register.haveAccount')}
                            </span>
                        </div>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                            {t('auth.register.signIn')}
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
