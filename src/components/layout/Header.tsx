'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, LogOut } from 'lucide-react';
import Link from 'next/link';

export function Header() {
    const { user, isAuthenticated, logout } = useAuth();
    const [isLoginOpen, setIsLoginOpen] = useState(false); // To be connected to a modal later

    return (
        <header className="bg-white text-zinc-900 border-b border-zinc-100 sticky top-0 z-50">
            <div className="container mx-auto flex justify-between items-center py-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 transition-opacity">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">Food Delivery</span>
                </Link>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {isAuthenticated && user ? (
                        <div className="flex items-center gap-4">
                            <Link href="/profile" className="text-zinc-700 font-medium flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                                Hello {user.firstName} {user.lastName}
                                <User size={16} />
                            </Link>
                            <button
                                onClick={() => logout()}
                                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1 rounded text-sm transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/login" className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-md font-medium transition-opacity shadow-sm">
                                Login
                            </Link>
                            <Link href="/register" className="border border-zinc-200 hover:border-primary hover:text-primary text-zinc-700 px-4 py-2 rounded-md font-medium transition-colors">
                                Register
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
