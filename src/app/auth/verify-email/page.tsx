import { Suspense } from 'react';
import { VerifyEmailClient } from './VerifyEmailClient';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center bg-white px-4 py-10">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
          </div>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
