'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authService } from '@/services/auth.service';
import { User, LoginDto, RegisterDto } from '@/types/auth';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    /** Authenticated through a throwaway QR guest account rather than a real login. */
    isGuest: boolean;
    isLoading: boolean;
    /**
     * Guarantees a usable session for the QR journey: keeps a signed-in
     * customer, revives an existing guest, and only creates a new guest when
     * neither is available. Concurrent callers share one in-flight request.
     */
    ensureSession: () => Promise<User | null>;
    login: (data: LoginDto) => Promise<void>;
    requestOtpLogin: (email: string, recaptchaToken?: string) => Promise<void>;
    registerWithOtp: (data: Omit<RegisterDto, 'password'>) => Promise<void>;
    verifyOtp: (email: string, code: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    completeGoogleLogin: () => Promise<User>;
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
    // Several table-mode callers (page mount, first add-to-cart) may ask for a
    // session at once; without this they would each mint their own guest.
    const guestSessionRef = useRef<Promise<User | null> | null>(null);

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

    const ensureSession = useCallback(async () => {
        const existingUser = authService.getUser();

        // A real login or a still-valid guest is reused as is. An expired
        // access token is not our problem here — the axios interceptor
        // refreshes it on the next call and only falls through to us if the
        // guest's five-hour absolute lifetime is over.
        if (authService.isAuthenticated() && existingUser) {
            return existingUser;
        }

        if (guestSessionRef.current) {
            return guestSessionRef.current;
        }

        guestSessionRef.current = (async () => {
            try {
                // Revive the existing session before minting a new guest —
                // a new guest owns a different, empty cart, so it is the last
                // resort rather than the first move.
                try {
                    await authService.refreshSessionFromCookies();
                    const refreshedUser = authService.getUser();
                    if (refreshedUser && authService.isAuthenticated()) {
                        setUser(refreshedUser);
                        setIsAuthenticated(true);
                        return refreshedUser;
                    }
                } catch {
                    // Nothing left to refresh (or the guest's five-hour
                    // lifetime is up) — fall through to a new guest.
                }

                const session = await authService.createGuestSession();
                setUser(session.user);
                setIsAuthenticated(true);
                return session.user;
            } catch (error) {
                console.error('Failed to create guest session', error);
                return null;
            } finally {
                guestSessionRef.current = null;
            }
        })();

        return guestSessionRef.current;
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

    const requestOtpLogin = async (email: string, recaptchaToken?: string) => {
        await authService.requestOtpLogin(email, recaptchaToken);
    };

    const registerWithOtp = async (data: Omit<RegisterDto, 'password'>) => {
        await authService.registerWithOtp(data);
    };

    const verifyOtp = async (email: string, code: string) => {
        setIsLoading(true);
        try {
            const response = await authService.verifyOtp({ email, code });
            setUser(response.user);
            setIsAuthenticated(true);
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithGoogle = async () => {
        setIsLoading(true);
        try {
            const response = await authService.startGoogleLogin();
            window.location.assign(response.redirectUrl);
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
    };

    const completeGoogleLogin = async () => {
        setIsLoading(true);
        try {
            const currentUser = await authService.completeGoogleLogin();
            setUser(currentUser);
            setIsAuthenticated(true);
            return currentUser;
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
            isGuest: !!user?.isGuest,
            isLoading,
            ensureSession,
            login,
            requestOtpLogin,
            registerWithOtp,
            verifyOtp,
            loginWithGoogle,
            completeGoogleLogin,
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
