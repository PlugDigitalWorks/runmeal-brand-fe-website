'use client';

import { GoogleAuthButton } from '@/components/features/GoogleAuthButton';
import { OtpChallenge } from '@/components/features/OtpChallenge';
import { RecaptchaWidget } from '@/components/features/RecaptchaWidget';
import { useAuth } from '@/context/AuthContext';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

type RegisterFormValues = { firstName: string; lastName: string; email: string; password?: string };
type RegisterMethod = 'otp' | 'password';

export default function RegisterPage() {
  const { register: registerUser, registerWithOtp, requestOtpLogin, verifyOtp } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [method, setMethod] = useState<RegisterMethod>('otp');
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
  const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

  const schema = z.object({
    firstName: z.string().min(2, t('auth.validation.firstNameMin')),
    lastName: z.string().min(2, t('auth.validation.lastNameMin')),
    email: z.string().email(t('auth.validation.emailInvalid')),
    password: z.string().optional(),
  });
  const { register, handleSubmit, setError, clearErrors, formState: { errors } } = useForm<RegisterFormValues>({ resolver: zodResolver(schema) });

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setRecaptchaResetKey((key) => key + 1);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    if (method === 'password' && (!data.password || data.password.length < 6)) {
      setError('password', { message: t('auth.validation.passwordMin') });
      return;
    }
    setIsLoading(true);
    try {
      if (method === 'otp') {
        await registerWithOtp({ email: data.email, firstName: data.firstName, lastName: data.lastName });
        setSentEmail(data.email);
        toast.success(t('auth.otp.sent'));
      } else {
        await registerUser({ email: data.email, firstName: data.firstName, lastName: data.lastName, password: data.password });
        toast.success(t('auth.register.success'));
        router.push('/login');
      }
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t('auth.register.error')));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (code: string) => {
    if (!sentEmail) return;
    setIsLoading(true);
    try {
      await verifyOtp(sentEmail, code);
      toast.success(t('auth.otp.success'));
      router.push('/');
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t('auth.authenticationFailed')));
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (!sentEmail) return;
    if (isRecaptchaEnabled && !recaptchaToken) {
      toast.error(t('auth.validation.securityCheck'));
      return;
    }
    setIsLoading(true);
    try {
      await requestOtpLogin(sentEmail, recaptchaToken ?? undefined);
      toast.success(t('auth.otp.resent'));
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t('auth.register.error')));
    } finally {
      resetCaptcha();
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        {!sentEmail && (
          <div className="space-y-2 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><UserPlus className="h-8 w-8 text-primary" /></div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t('auth.register.title')}</h1>
            <p className="text-zinc-500">{t('auth.register.subtitle')}</p>
          </div>
        )}

        {sentEmail ? (
          <OtpChallenge
            email={sentEmail}
            isLoading={isLoading}
            onVerify={verifyCode}
            onResend={resendCode}
            onBack={() => { setSentEmail(null); resetCaptcha(); }}
            resendDisabled={isRecaptchaEnabled && !recaptchaToken}
            resendVerification={<RecaptchaWidget onTokenChange={setRecaptchaToken} resetKey={recaptchaResetKey} />}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <GoogleAuthButton label={t('auth.register.googleSignup')} />
            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div><div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-zinc-500">{t('auth.register.orEmail')}</span></div></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-zinc-700" htmlFor="firstName">{t('auth.register.firstName')}</label><input {...register('firstName')} id="firstName" autoComplete="given-name" placeholder={t('auth.register.firstNamePlaceholder')} className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />{errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}</div>
              <div className="space-y-2"><label className="text-sm font-medium text-zinc-700" htmlFor="lastName">{t('auth.register.lastName')}</label><input {...register('lastName')} id="lastName" autoComplete="family-name" placeholder={t('auth.register.lastNamePlaceholder')} className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />{errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}</div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-zinc-700" htmlFor="email">{t('auth.email')}</label><input {...register('email')} id="email" type="email" autoComplete="email" placeholder={t('auth.emailPlaceholder')} className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />{errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}</div>

            {method === 'password' && (
              <div className="space-y-2"><label className="text-sm font-medium text-zinc-700" htmlFor="password">{t('auth.password')}</label><div className="relative"><input {...register('password')} id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" className="w-full rounded-md border border-zinc-200 px-3 py-2 pr-10 text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}</div>
            )}

            <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isLoading ? (method === 'otp' ? t('auth.otp.sendingCode') : t('auth.register.submitting')) : (method === 'otp' ? t('auth.otp.sendCode') : t('auth.register.submit'))}</button>
            <button type="button" onClick={() => { setMethod(method === 'otp' ? 'password' : 'otp'); clearErrors(); }} className="w-full text-sm font-medium text-primary hover:text-primary/80">{method === 'otp' ? t('auth.otp.usePassword') : t('auth.otp.useCode')}</button>
            <div className="text-center text-sm text-zinc-500">{t('auth.register.haveAccount')} <Link href="/login" className="font-medium text-primary hover:text-primary/80">{t('auth.register.signIn')}</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}
