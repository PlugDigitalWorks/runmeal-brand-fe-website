'use client';

import { AuthRedirectingScreen } from '@/components/features/AuthRedirectingScreen';
import { OAuthButtons } from '@/components/features/OAuthButtons';
import { OtpChallenge } from '@/components/features/OtpChallenge';
import { RecaptchaWidget } from '@/components/features/RecaptchaWidget';
import { useAuth } from '@/context/AuthContext';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import { takeReturnPath } from '@/lib/return-path';
import { OAuthProvider } from '@/types/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

type LoginFormValues = { email: string; password?: string };
type LoginMethod = 'otp' | 'password';

/** The API's `reason` when the customer cancels on Apple's page (AUTH_APPLE_CANCELLED). */
const APPLE_CANCELLED_REASON = 'Apple sign-in was cancelled.';

export default function LoginPage() {
  const { login, requestOtpLogin, verifyOtp, completeOAuthLogin } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [method, setMethod] = useState<LoginMethod>('otp');
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Set once auth succeeds (or a Google/Apple callback is being redeemed): the
  // form stays hidden until the router has left this page.
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
  const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
  const handledOAuthCallbackRef = useRef(false);

  const schema = z.object({
    email: z.string().email(t('auth.validation.emailInvalid')),
    password: z.string().optional(),
  });
  const { register, handleSubmit, setError, clearErrors, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
  });

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setRecaptchaResetKey((key) => key + 1);
  };

  const onSubmit = async (data: LoginFormValues) => {
    if (method === 'password' && (!data.password || data.password.length < 6)) {
      setError('password', { message: t('auth.validation.passwordMin') });
      return;
    }
    if (isRecaptchaEnabled && !recaptchaToken) {
      toast.error(t('auth.validation.securityCheck'));
      return;
    }

    setIsLoading(true);
    try {
      if (method === 'otp') {
        await requestOtpLogin(data.email, recaptchaToken ?? undefined);
        setSentEmail(data.email);
        toast.success(t('auth.otp.sent'));
      } else {
        await login({ email: data.email, password: data.password, recaptchaToken: recaptchaToken ?? undefined });
        setIsRedirecting(true);
        toast.success(t('auth.login.success'));
        router.push(takeReturnPath());
      }
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t('auth.login.error')));
    } finally {
      resetCaptcha();
      setIsLoading(false);
    }
  };

  const verifyCode = async (code: string) => {
    if (!sentEmail) return;
    setIsLoading(true);
    try {
      await verifyOtp(sentEmail, code);
      setIsRedirecting(true);
      toast.success(t('auth.otp.success'));
      router.push(takeReturnPath());
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t('auth.authenticationFailed')));
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async (resendToken?: string) => {
    if (!sentEmail) return;
    if (isRecaptchaEnabled && !resendToken) {
      toast.error(t('auth.validation.securityCheck'));
      return;
    }
    setIsLoading(true);
    try {
      await requestOtpLogin(sentEmail, resendToken);
      toast.success(t('auth.otp.resent'));
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t('auth.login.error')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (handledOAuthCallbackRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    if (!authStatus) return;
    handledOAuthCallbackRef.current = true;
    const reason = params.get('reason');
    // The handoff code is a one-time credential: take it off the URL first.
    const handoff = params.get('handoff') || undefined;
    // `provider` names the exchange route; a return without it is Google's.
    const provider: OAuthProvider = params.get('provider') === 'apple' ? 'apple' : 'google';
    window.history.replaceState(null, '', '/login');
    if (authStatus === 'success') {
      setIsRedirecting(true);
      completeOAuthLogin(provider, handoff)
        .then(() => { toast.success(t(`auth.login.${provider}Success`)); router.push(takeReturnPath()); })
        .catch((error) => {
          setIsRedirecting(false);
          toast.error(
            handoff
              ? resolveApiErrorMessage(error, t(`auth.login.${provider}Failed`))
              : t('auth.login.googleRestoreError'),
          );
        });
      return;
    }
    // Backing out of Apple's page is the customer's choice, not an error.
    if (reason === APPLE_CANCELLED_REASON) {
      toast(t('apiErrors.AUTH_APPLE_CANCELLED'));
      return;
    }
    toast.error(reason || t('auth.login.oauthFailed'));
  }, [completeOAuthLogin, router, t]);

  if (isRedirecting) return <AuthRedirectingScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        {!sentEmail && (
          <div className="space-y-2 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t('auth.login.title')}</h1>
            <p className="text-zinc-500">{t('auth.login.subtitle')}</p>
          </div>
        )}

        {sentEmail ? (
          <OtpChallenge
            email={sentEmail}
            isLoading={isLoading}
            onVerify={verifyCode}
            onResend={resendCode}
            onBack={() => { setSentEmail(null); resetCaptcha(); }}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <OAuthButtons />
            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div><div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-zinc-500">{t('auth.login.orEmail')}</span></div></div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700" htmlFor="email">{t('auth.email')}</label>
                <input {...register('email')} id="email" type="email" autoComplete="email" placeholder={t('auth.emailPlaceholder')} className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              {method === 'password' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><label className="text-sm font-medium text-zinc-700" htmlFor="password">{t('auth.password')}</label><Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">{t('auth.login.forgot')}</Link></div>
                  <div className="relative">
                    <input {...register('password')} id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="w-full rounded-md border border-zinc-200 px-3 py-2 pr-10 text-zinc-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                </div>
              )}
            </div>

            <RecaptchaWidget onTokenChange={setRecaptchaToken} resetKey={recaptchaResetKey} />
            <button type="submit" disabled={isLoading || (isRecaptchaEnabled && !recaptchaToken)} className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? (method === 'otp' ? t('auth.otp.sendingCode') : t('auth.login.submitting')) : (method === 'otp' ? t('auth.otp.sendCode') : t('auth.login.submit'))}
            </button>
            <button type="button" onClick={() => { setMethod(method === 'otp' ? 'password' : 'otp'); clearErrors(); resetCaptcha(); }} className="w-full text-sm font-medium text-primary hover:text-primary/80">
              {method === 'otp' ? t('auth.otp.usePassword') : t('auth.otp.useCode')}
            </button>
            <div className="text-center text-sm text-zinc-500">{t('auth.login.noAccount')} <Link href="/register" className="font-medium text-primary hover:text-primary/80">{t('auth.login.createAccount')}</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}
