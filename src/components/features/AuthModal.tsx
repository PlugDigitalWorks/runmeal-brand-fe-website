'use client';

import { useAuth } from '@/context/AuthContext';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import { X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { OtpChallenge } from './OtpChallenge';
import { RecaptchaWidget } from './RecaptchaWidget';

type Tab = 'LOGIN' | 'REGISTER';
type Method = 'otp' | 'password';

export function AuthModal() {
  const { t } = useTranslation();
  const { isAuthModalOpen, closeAuthModal, login, register, requestOtpLogin, registerWithOtp, verifyOtp } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('LOGIN');
  const [method, setMethod] = useState<Method>('otp');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
  const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setRecaptchaResetKey((key) => key + 1);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setSentEmail(null);
    setMethod('otp');
    resetCaptcha();
  };

  const handleClose = () => {
    closeAuthModal();
    setTimeout(() => { setActiveTab('LOGIN'); resetForm(); }, 200);
  };

  const changeTab = (tab: Tab) => {
    setActiveTab(tab);
    setSentEmail(null);
    setMethod('otp');
    resetCaptcha();
  };

  const splitName = () => {
    const parts = name.trim().split(/\s+/);
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const needsCaptcha = activeTab === 'LOGIN';
    if (needsCaptcha && isRecaptchaEnabled && !recaptchaToken) {
      toast.error(t('auth.validation.securityCheck'));
      return;
    }

    setIsLoading(true);
    try {
      if (activeTab === 'LOGIN') {
        if (method === 'otp') {
          await requestOtpLogin(email, recaptchaToken ?? undefined);
          setSentEmail(email);
          toast.success(t('auth.otp.sent'));
        } else {
          await login({ email, password, recaptchaToken: recaptchaToken ?? undefined });
          toast.success(t('auth.login.success'));
          handleClose();
        }
      } else {
        const person = splitName();
        if (person.firstName.length < 2 || person.lastName.length < 2) {
          toast.error(person.firstName.length < 2 ? t('auth.validation.firstNameMin') : t('auth.validation.lastNameMin'));
          return;
        }
        if (method === 'otp') {
          await registerWithOtp({ email, ...person });
          setSentEmail(email);
          toast.success(t('auth.otp.sent'));
        } else {
          await register({ email, password, phoneNumber: phone, ...person });
          toast.success(t('auth.register.success'));
          changeTab('LOGIN');
        }
      }
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t('auth.authenticationFailed')));
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
      toast.success(t('auth.otp.success'));
      handleClose();
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
      toast.error(resolveApiErrorMessage(error, t('auth.authenticationFailed')));
    } finally {
      resetCaptcha();
      setIsLoading(false);
    }
  };

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <button onClick={handleClose} aria-label={t('common.cancel')} className="absolute right-4 top-4 z-10 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"><X size={20} /></button>
        {!sentEmail && (
          <div className="flex border-b border-zinc-100">
            <button onClick={() => changeTab('LOGIN')} className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'LOGIN' ? 'border-b-2 border-primary text-primary' : 'text-zinc-500 hover:text-zinc-700'}`}>{t('auth.login.submit')}</button>
            <button onClick={() => changeTab('REGISTER')} className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'REGISTER' ? 'border-b-2 border-primary text-primary' : 'text-zinc-500 hover:text-zinc-700'}`}>{t('auth.register.submit')}</button>
          </div>
        )}

        <div className="p-6">
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
            <>
              <h2 className="mb-2 text-xl font-bold text-zinc-800">{activeTab === 'LOGIN' ? t('auth.login.title') : t('auth.register.title')}</h2>
              <p className="mb-6 text-sm text-zinc-500">{activeTab === 'LOGIN' ? t('auth.login.modalSubtitle') : t('auth.register.modalSubtitle')}</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === 'REGISTER' && (
                  <>
                    <div className="space-y-1"><label className="text-xs font-medium text-zinc-700">{t('auth.fullName')}</label><input type="text" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder={t('auth.fullNamePlaceholder')} /></div>
                    {method === 'password' && <div className="space-y-1"><label className="text-xs font-medium text-zinc-700">{t('auth.phone')}</label><input type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="+90 555 123 4567" /></div>}
                  </>
                )}
                <div className="space-y-1"><label className="text-xs font-medium text-zinc-700">{t('auth.email')}</label><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder={t('auth.emailPlaceholder')} /></div>
                {method === 'password' && <div className="space-y-1"><label className="text-xs font-medium text-zinc-700">{t('auth.password')}</label><input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="••••••••" /></div>}
                {activeTab === 'LOGIN' && <RecaptchaWidget onTokenChange={setRecaptchaToken} resetKey={recaptchaResetKey} />}
                <button type="submit" disabled={isLoading || (activeTab === 'LOGIN' && isRecaptchaEnabled && !recaptchaToken)} className="mt-2 w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? t('common.processing') : method === 'otp' ? t('auth.otp.sendCode') : activeTab === 'LOGIN' ? t('auth.login.submit') : t('auth.register.submit')}</button>
                <button type="button" onClick={() => { setMethod(method === 'otp' ? 'password' : 'otp'); resetCaptcha(); }} className="w-full text-sm font-medium text-primary hover:text-primary/80">{method === 'otp' ? t('auth.otp.usePassword') : t('auth.otp.useCode')}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
