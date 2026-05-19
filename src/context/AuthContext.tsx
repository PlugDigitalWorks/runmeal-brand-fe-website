'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import { User, LoginDto, RegisterDto } from '@/types/auth';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (data: LoginDto) => Promise<void>;
    register: (data: RegisterDto) => Promise<void>;
    logout: () => Promise<void>;
    // Modal Control
    isAuthModalOpen: boolean;
    openAuthModal: () => void;
    closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        const initAuth = () => {
            const currentUser = authService.getUser();
            const authenticated = authService.isAuthenticated();
            setUser(currentUser);
            setIsAuthenticated(authenticated);
            setIsLoading(false);
        };
        initAuth();
    }, []);

    const login = async (data: LoginDto) => {
        setIsLoading(true);
        try {
            const response = await authService.login(data);
            if (response && response.user) {
                setUser(response.user);
                setIsAuthenticated(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (data: RegisterDto) => {
        setIsLoading(true);
        try {
            await authService.register(data);
            // No auto-login, users must login manually
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            await authService.logout();
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const openAuthModal = () => setIsAuthModalOpen(true);
    const closeAuthModal = () => setIsAuthModalOpen(false);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            login,
            register,
            logout,
            isAuthModalOpen,
            openAuthModal,
            closeAuthModal
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
