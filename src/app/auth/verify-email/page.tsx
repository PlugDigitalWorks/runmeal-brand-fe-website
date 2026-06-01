import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import { VerifyEmailClient } from './VerifyEmailClient';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center bg-white px-4 py-10">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading verification link...
          </div>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
