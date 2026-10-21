'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { rememberReturnPath, resolveAuthTarget } from '@/lib/return-path';

/**
 * Reads `?to=loyalty` or `?to=<branch slug>` (a printed QR) on the login and
 * register pages: where the customer lands once signed in. It is stored as
 * the return path, so it holds through OTP, the Google/Apple round trip and
 * a hop between login and register; a customer already signed in is sent
 * there straight away, and the hook returns true while that happens.
 */
export function useAuthTargetFromQuery(): boolean {
    const router = useRouter();
    const { isAuthenticated, isGuest, isLoading } = useAuth();
    const handledRef = useRef(false);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        if (handledRef.current || isLoading) return;
        handledRef.current = true;
        const target = resolveAuthTarget(new URLSearchParams(window.location.search).get('to'));
        if (!target) return;
        if (isAuthenticated && !isGuest) {
            router.replace(target);
            // Deferred like the profile page's `?action=new`: no setState in the effect body.
            setTimeout(() => setIsLeaving(true), 0);
            return;
        }
        rememberReturnPath(target);
    }, [isLoading, isAuthenticated, isGuest, router]);

    return isLeaving;
}
