'use client';

import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface OtpChallengeProps {
  email: string;
  isLoading: boolean;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  resendDisabled?: boolean;
  resendVerification?: ReactNode;
}

export function OtpChallenge({ email, isLoading, onVerify, onResend, onBack, resendDisabled, resendVerification }: OtpChallengeProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === 6) void onVerify(code);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{t('auth.otp.title')}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t('auth.otp.sentTo', { email })}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="otp-code" className="text-sm font-medium text-zinc-700">
          {t('auth.otp.code')}
        </label>
        <input
          id="otp-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus
          placeholder={t('auth.otp.placeholder')}
          className="w-full rounded-md border border-zinc-200 px-4 py-3 text-center text-2xl font-semibold tracking-[0.45em] text-zinc-900 outline-none transition-all placeholder:tracking-normal placeholder:text-zinc-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="text-xs text-zinc-500">{t('auth.otp.expires')}</p>
      </div>

      <button
        type="submit"
        disabled={isLoading || code.length !== 6}
        className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? t('auth.otp.verifying') : t('auth.otp.verify')}
      </button>

      {resendVerification}

      <div className="flex items-center justify-between gap-4 text-sm">
        <button type="button" onClick={onBack} disabled={isLoading} className="inline-flex items-center text-zinc-500 hover:text-zinc-800 disabled:opacity-50">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('auth.otp.changeEmail')}
        </button>
        <button type="button" onClick={() => void onResend()} disabled={isLoading || resendDisabled} className="font-medium text-primary hover:text-primary/80 disabled:opacity-50">
          {t('auth.otp.resend')}
        </button>
      </div>
    </form>
  );
}
