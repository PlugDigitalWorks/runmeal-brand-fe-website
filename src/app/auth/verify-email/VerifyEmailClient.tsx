'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, MailCheck, XCircle } from 'lucide-react';

import { authService } from '@/services/auth.service';

type VerificationStatus = 'verifying' | 'success' | 'error' | 'missing-token';

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message;
  }
  return undefined;
};

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<VerificationStatus>(
    token ? 'verifying' : 'missing-token',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    let isActive = true;
    let redirectTimer: number | undefined;

    const verifyEmail = async () => {
      try {
        const response = await authService.verifyEmail(token);
        if (!isActive) return;

        setMessage(response.data?.message || response.message || 'Email verified successfully.');
        setStatus('success');
        redirectTimer = window.setTimeout(() => {
          router.push('/login');
        }, 2500);
      } catch (error) {
        if (!isActive) return;

        setMessage(getErrorMessage(error) || 'Invalid or expired verification token.');
        setStatus('error');
      }
    };

    void verifyEmail();

    return () => {
      isActive = false;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [router, token]);

  const content = {
    verifying: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-primary" />,
      title: 'Verifying Email',
      description: 'Please wait while we verify your email address.',
      tone: 'bg-primary/10',
    },
    success: {
      icon: <CheckCircle className="h-8 w-8 text-green-600" />,
      title: 'Email Verified',
      description: message || 'Your email has been verified. You can now log in.',
      tone: 'bg-green-50',
    },
    error: {
      icon: <XCircle className="h-8 w-8 text-red-600" />,
      title: 'Verification Failed',
      description: message || 'This verification link is invalid or expired.',
      tone: 'bg-red-50',
    },
    'missing-token': {
      icon: <MailCheck className="h-8 w-8 text-zinc-600" />,
      title: 'Verification Link Missing',
      description: 'Open the verification link from your email to verify your account.',
      tone: 'bg-zinc-100',
    },
  }[status];

  return (
    <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${content.tone}`}>
          {content.icon}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {content.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {content.description}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Go to Login
          </Link>
          <Link
            href="/register"
            className="inline-flex w-full items-center justify-center rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-primary hover:text-primary"
          >
            Create Another Account
          </Link>
        </div>
      </div>
    </div>
  );
}
