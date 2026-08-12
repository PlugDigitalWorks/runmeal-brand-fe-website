'use client';

import { CheckCircle2, Loader2, Mail, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { RecaptchaWidget } from '@/components/features/RecaptchaWidget';
import { useAuth } from '@/context/AuthContext';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import {
  orderService,
  ReceiptAccountResponse,
  ReceiptDeliveryStatus,
} from '@/services/order.service';

interface ReceiptAccountPanelProps {
  orderId: string;
}

export function ReceiptAccountPanel({ orderId }: ReceiptAccountPanelProps) {
  const { t } = useTranslation();
  const { user, isGuest, requestOtpLogin, verifyOtp } = useAuth();
  const initialEmail = !isGuest && user?.email ? user.email : '';
  const [email, setEmail] = useState(initialEmail);
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<ReceiptAccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [otpDismissed, setOtpDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
  const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setRecaptchaResetKey((value) => value + 1);
  };

  const submitReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!accepted || !email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await orderService.requestReceiptAccount(orderId, email);
      setEmail(email.trim().toLowerCase());
      setResult(response);
      setOtpDismissed(false);
      setCode('');
    } catch (requestError) {
      setError(resolveApiErrorMessage(requestError, t('payment.receipt.errors.generic')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (isRecaptchaEnabled && !recaptchaToken) {
      setError(t('auth.validation.securityCheck'));
      return;
    }
    setIsResending(true);
    setError(null);
    try {
      await requestOtpLogin(email, recaptchaToken ?? undefined);
      setResult((current) => current ? { ...current, otpStatus: 'sent', otpExpiresInSeconds: 300 } : current);
      setOtpDismissed(false);
      toast.success(t('auth.otp.resent'));
    } catch (requestError) {
      setError(resolveApiErrorMessage(requestError, t('payment.receipt.errors.otpResend')));
    } finally {
      resetCaptcha();
      setIsResending(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return;
    setIsVerifying(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      setResult((current) => current ? { ...current, otpStatus: 'not_required', otpExpiresInSeconds: null } : current);
      toast.success(t('auth.otp.success'));
    } catch (requestError) {
      setError(resolveApiErrorMessage(requestError, t('payment.receipt.errors.otpVerify')));
    } finally {
      setIsVerifying(false);
    }
  };

  const receiptMessage = (status: ReceiptDeliveryStatus) => t(`payment.receipt.status.${status}`);
  const showOtp = result?.otpStatus === 'sent' && !otpDismissed;
  const showResend = result?.otpStatus === 'failed' || showOtp;

  return (
    <section className="mb-6 mt-5 rounded-xl border border-orange-100 bg-orange-50/60 p-4 text-left">
      {!result ? (
        <form onSubmit={submitReceipt} className="space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-zinc-900">{t('payment.receipt.title')}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t('payment.receipt.disclaimer')}</p>
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">{t('auth.email')}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
            <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>{t('payment.receipt.consent')}</span>
          </label>
          {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={isSubmitting || !accepted} className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? t('payment.receipt.submitting') : t('payment.receipt.submit')}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">{receiptMessage(result.receiptStatus)}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t('payment.receipt.disclaimer')}</p>
            </div>
          </div>

          {result.receiptStatus === 'queued' && (
            <button type="button" onClick={() => setResult(null)} className="text-sm font-medium text-primary hover:text-primary/80">{t('payment.receipt.retryReceipt')}</button>
          )}

          {result.otpStatus === 'not_required' && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{t('payment.receipt.accountReady')}</p>
          )}

          {result.otpStatus === 'failed' && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t('payment.receipt.otpFailed')}</p>
          )}

          {showOtp && (
            <form onSubmit={verifyCode} className="space-y-3 border-t border-orange-100 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-semibold text-zinc-900">{t('auth.otp.title')}</h3><p className="mt-1 text-xs text-zinc-600">{t('auth.otp.sentTo', { email })}</p></div>
                <button type="button" onClick={() => setOtpDismissed(true)} aria-label={t('payment.receipt.dismissOtp')} className="rounded-full p-1 text-zinc-400 hover:bg-white hover:text-zinc-700"><X className="h-4 w-4" /></button>
              </div>
              <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" placeholder={t('auth.otp.placeholder')} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-lg font-semibold tracking-[0.35em] text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              {result.otpExpiresInSeconds && (
                <p className="text-xs text-zinc-500">{t('payment.receipt.otpExpires', { minutes: Math.ceil(result.otpExpiresInSeconds / 60) })}</p>
              )}
              <button type="submit" disabled={isVerifying || code.length !== 6} className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isVerifying ? t('auth.otp.verifying') : t('auth.otp.verify')}</button>
              <p className="text-xs text-zinc-500">{t('payment.receipt.otpOptional')}</p>
            </form>
          )}

          {showResend && (
            <div className="space-y-2">
              <RecaptchaWidget onTokenChange={setRecaptchaToken} resetKey={recaptchaResetKey} />
              <button type="button" onClick={() => void resendOtp()} disabled={isResending || (isRecaptchaEnabled && !recaptchaToken)} className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50">{isResending ? t('auth.otp.sendingCode') : t('auth.otp.resend')}</button>
            </div>
          )}

          {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}
