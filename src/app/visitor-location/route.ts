import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';

import type { VisitorLocation } from '@/lib/visitor-location';

/** The slice of Cloudflare's `request.cf` IP geolocation this route reads. */
type VisitorCf = {
  country?: string;
  region?: string;
  regionCode?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
};

const toCoordinate = (value?: string) => {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : null;
};

/**
 * Approximate visitor location from Cloudflare's IP geolocation, used to
 * centre a new address on where the customer is. Lives outside `/api`, which
 * is rewritten to the backend. Every field is null when Cloudflare has nothing
 * (local dev without a `cf` object, unknown IPs) so the caller falls back.
 */
export function GET(request: NextRequest) {
  let cf: VisitorCf | undefined;
  try {
    cf = getCloudflareContext<VisitorCf>().cf;
  } catch {
    cf = undefined;
  }

  const country = (cf?.country || request.headers.get('cf-ipcountry') || '').toUpperCase();
  const latitude = toCoordinate(cf?.latitude);
  const longitude = toCoordinate(cf?.longitude);

  const location: VisitorLocation = {
    // `XX` / `T1` are Cloudflare's "unknown" and "Tor" markers, not countries.
    countryCode: /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : null,
    region: cf?.region || null,
    regionCode: cf?.regionCode || null,
    city: cf?.city || null,
    latitude: latitude !== null && longitude !== null ? latitude : null,
    longitude: latitude !== null && longitude !== null ? longitude : null,
  };

  return NextResponse.json(location, { headers: { 'Cache-Control': 'private, no-store' } });
}
