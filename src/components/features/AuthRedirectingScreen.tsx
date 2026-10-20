'use client';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Shown on the login / register pages once auth has succeeded (or while the
 * Google callback is being redeemed), so the form does not flash back up
 * before the customer lands on the return page.
 */
export function AuthRedirectingScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm font-medium text-zinc-600">{t('auth.login.submitting')}</p>
    </div>
  );
}
