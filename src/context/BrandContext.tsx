'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  resolveBrand,
  setBrandId,
  getFallbackBrandId,
  type ResolvedBrand,
} from '@/lib/brand-store';

type BrandStatus = 'loading' | 'ready' | 'error';

interface BrandContextType {
  /** The resolved brand, or null when running on the local-dev env fallback. */
  brand: ResolvedBrand | null;
  status: BrandStatus;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<ResolvedBrand | null>(null);
  const [status, setStatus] = useState<BrandStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const resolved = await resolveBrand();
        if (cancelled) return;
        setBrandId(resolved.brandId);
        setBrand(resolved);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;

        const fallback = getFallbackBrandId();
        if (fallback) {
          // Local dev without the domain router Worker in front of the app.
          console.warn(
            '[brand] resolve failed, falling back to NEXT_PUBLIC_BRAND_ID (dev only)',
            error,
          );
          setBrandId(fallback);
          setStatus('ready');
        } else {
          console.error('[brand] resolve failed', error);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return <BrandBootScreen />;
  }

  if (status === 'error') {
    return <BrandUnavailableScreen />;
  }

  return (
    <BrandContext.Provider value={{ brand, status }}>
      {children}
    </BrandContext.Provider>
  );
}

function BrandBootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
    </div>
  );
}

function BrandUnavailableScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-zinc-800">Brand bulunamadı</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Bu domain aktif değil. Lütfen adresi kontrol edin veya daha sonra tekrar deneyin.
        </p>
      </div>
    </div>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
