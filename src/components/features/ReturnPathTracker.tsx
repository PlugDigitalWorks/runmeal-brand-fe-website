'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { rememberReturnPath } from '@/lib/return-path';

/**
 * Records the page the customer is on so login / register can send them back
 * to it (see `lib/return-path`). The full URL is read from `window.location`
 * because a QR table lives in the query string (`/order?qr=…`); a branch pick
 * rewrites the path with `history.replaceState`, which Next reflects in
 * `usePathname`, so that is caught too.
 */
export function ReturnPathTracker() {
    const pathname = usePathname();

    useEffect(() => {
        rememberReturnPath(`${window.location.pathname}${window.location.search}`);
    }, [pathname]);

    return null;
}
