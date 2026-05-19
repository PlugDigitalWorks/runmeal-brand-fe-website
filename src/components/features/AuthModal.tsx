'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X } from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'LOGIN' | 'REGISTER';

export function AuthModal() {
    const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('LOGIN');
    const [isLoading, setIsLoading] = useState(false);

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
        setIsLoading(true);

        try {
            if (activeTab === 'LOGIN') {
                await login({ email, password });
                toast.success('Welcome back!');
                handleClose();
            } else {
                await register({
                    email,
                    password,
                    firstName: name.split(' ')[0] || '',
                    lastName: name.split(' ').slice(1).join(' ') || '',
                    phoneNumber: phone
                });
                toast.success('Registration successful! Please login.');
                setActiveTab('LOGIN');
                // Don't close, let them login or auto-login if logic changes
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Authentication failed');
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
                        onClick={() => setActiveTab('LOGIN')}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'LOGIN' ? 'text-primary border-b-2 border-primary' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setActiveTab('REGISTER')}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'REGISTER' ? 'text-primary border-b-2 border-primary' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        Register
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <h2 className="text-xl font-bold text-zinc-800 mb-2">
                        {activeTab === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-sm text-zinc-500 mb-6">
                        {activeTab === 'LOGIN'
                            ? 'Enter your credentials to access your account.'
                            : 'Join us to order food from your favorite restaurants.'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {activeTab === 'REGISTER' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-zinc-700">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-zinc-700">Phone</label>
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
                            <label className="text-xs font-medium text-zinc-700">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-700">Password</label>
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

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {isLoading ? 'Processing...' : (activeTab === 'LOGIN' ? 'Login' : 'Sign Up')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
