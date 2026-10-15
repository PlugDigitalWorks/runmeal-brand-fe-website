/** What `/visitor-location` answers: Cloudflare's IP geolocation, or nulls. */
export interface VisitorLocation {
  countryCode: string | null;
  region: string | null;
  regionCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Where a new address starts when the visitor's location is unknown:
 * Richmond, London. Named the way Google geocodes it so the form's selects
 * and a later map pick agree.
 */
export const DEFAULT_ADDRESS_LOCATION = {
  countryCode: 'GB',
  province: 'England',
  district: 'Richmond',
  latitude: 51.4613,
  longitude: -0.3037,
} as const;

export async function fetchVisitorLocation(): Promise<VisitorLocation | null> {
  try {
    const response = await fetch('/visitor-location', { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as VisitorLocation;
  } catch {
    return null;
  }
}
