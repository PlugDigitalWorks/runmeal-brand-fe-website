/**
 * Brand store — holds the active brandId resolved from the incoming domain.
 *
 * The brand is resolved once on boot via `GET /api/brands/resolve` (the domain
 * router Worker proxies this to the backend and injects the secure tenant
 * headers). Non-React modules (axios interceptor, service functions) read the
 * active id through `getBrandId()`; the BrandProvider writes it via `setBrandId()`
 * after a successful resolve.
 *
 * There is NO hardcoded brandId. `NEXT_PUBLIC_BRAND_ID` is only a local-dev
 * fallback for when the Worker isn't in front of the app; in production it is
 * empty, so resolve is mandatory.
 */

const ENV_FALLBACK_BRAND_ID = process.env.NEXT_PUBLIC_BRAND_ID || '';

let currentBrandId = ENV_FALLBACK_BRAND_ID;

export function getBrandId(): string {
  return currentBrandId;
}

export function setBrandId(brandId: string): void {
  currentBrandId = brandId;
}

/** Local-dev fallback brandId (empty in production). */
export function getFallbackBrandId(): string {
  return ENV_FALLBACK_BRAND_ID;
}

export type ResolvedBrand = {
  brandId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryDomain: string;
  defaultDomain: string;
};

type BrandResolveResponse = {
  status: boolean;
  message: string;
  data: ResolvedBrand;
};

/**
 * Resolve the active brand from the current domain. Must be called with a
 * relative path so the domain router Worker can attach the tenant headers.
 */
export async function resolveBrand(): Promise<ResolvedBrand> {
  const response = await fetch('/api/brands/resolve', {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Brand domain could not be resolved');
  }

  const payload = (await response.json()) as BrandResolveResponse;

  if (!payload.status || !payload.data?.brandId) {
    throw new Error('Brand domain could not be resolved');
  }

  return payload.data;
}
