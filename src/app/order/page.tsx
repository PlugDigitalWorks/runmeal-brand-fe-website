import { Suspense } from 'react';

import { OrderPageClient } from './OrderPageClient';

function OrderPageFallback() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
        </div>
    );
}

/** QR landing route: `/order?qr=<opaqueQrToken>`. */
export default function OrderPage() {
    return (
        <Suspense fallback={<OrderPageFallback />}>
            <OrderPageClient />
        </Suspense>
    );
}
