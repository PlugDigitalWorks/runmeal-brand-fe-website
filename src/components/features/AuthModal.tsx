'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { RecaptchaWidget } from './RecaptchaWidget';
import { useTranslation } from 'react-i18next';

type Tab = 'LOGIN' | 'REGISTER';

export function AuthModal() {
    const { t } = useTranslation();
    const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('LOGIN');
    const [isLoading, setIsLoading] = useState(false);
    const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
    const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
    const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
        setRecaptchaToken(null);
        setRecaptchaResetKey((key) => key + 1);
    };

    const getErrorMessage = (error: unknown) => {
        if (typeof error === 'object' && error !== null && 'response' in error) {
            const response = (error as { response?: { data?: { message?: string } } }).response;
            return response?.data?.message;
        }
        return undefined;
    };

    const changeTab = (tab: Tab) => {
        setActiveTab(tab);
        setRecaptchaToken(null);
        setRecaptchaResetKey((key) => key + 1);
    };

    const handleClose = () => {
        closeAuthModal();
        // Optional: wait a bit before reset to avoid UI flicker
        setTimeout(() => {
            setActiveTab('LOGIN');
            resetForm();
        }, 200);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (activeTab === 'LOGIN' && isRecaptchaEnabled && !recaptchaToken) {
            toast.error(t('auth.validation.securityCheck'));
            return;
        }

        setIsLoading(true);

        try {
            if (activeTab === 'LOGIN') {
                await login({ email, password, recaptchaToken: recaptchaToken ?? undefined });
                toast.success(t('auth.login.success'));
                handleClose();
            } else {
                await register({
                    email,
                    password,
                    firstName: name.split(' ')[0] || '',
                    lastName: name.split(' ').slice(1).join(' ') || '',
                    phoneNumber: phone
                });
                toast.success(t('auth.register.success'));
                changeTab('LOGIN');
                // Don't close, let them login or auto-login if logic changes
            }
        } catch (error: unknown) {
            console.error(error);
            if (activeTab === 'LOGIN') {
                setRecaptchaToken(null);
                setRecaptchaResetKey((key) => key + 1);
            }
            toast.error(getErrorMessage(error) || t('auth.authenticationFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthModalOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col relative" onClick={(e) => e.stopPropagation()}>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Tabs */}
                <div className="flex border-b border-zinc-100">
                    <button
                        onClick={() => changeTab('LOGIN')}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'LOGIN' ? 'text-primary border-b-2 border-primary' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        {t('auth.login.submit')}
                    </button>
                    <button
                        onClick={() => changeTab('REGISTER')}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'REGISTER' ? 'text-primary border-b-2 border-primary' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        {t('auth.register.submit')}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <h2 className="text-xl font-bold text-zinc-800 mb-2">
                        {activeTab === 'LOGIN' ? t('auth.login.title') : t('auth.register.title')}
                    </h2>
                    <p className="text-sm text-zinc-500 mb-6">
                        {activeTab === 'LOGIN'
                            ? t('auth.login.modalSubtitle')
                            : t('auth.register.modalSubtitle')}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {activeTab === 'REGISTER' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-zinc-700">{t('auth.fullName')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                        placeholder={t('auth.fullNamePlaceholder')}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-zinc-700">{t('auth.phone')}</label>
                                    <input
                                        type="tel"
                                        required
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                        placeholder="+90 555 123 4567"
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-700">{t('auth.email')}</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                placeholder={t('auth.emailPlaceholder')}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-700">{t('auth.password')}</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                placeholder="••••••••"
                            />
                        </div>

                        {activeTab === 'LOGIN' && (
                            <RecaptchaWidget
                                onTokenChange={setRecaptchaToken}
                                resetKey={recaptchaResetKey}
                            />
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || (activeTab === 'LOGIN' && isRecaptchaEnabled && !recaptchaToken)}
                            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {isLoading ? t('common.processing') : (activeTab === 'LOGIN' ? t('auth.login.submit') : t('auth.register.submit'))}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
