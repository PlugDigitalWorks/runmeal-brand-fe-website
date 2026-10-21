/**
 * Where to send a customer after they sign in or sign up: the last storefront
 * page they were on — a branch link (`/richmond`), a QR table (`/order?qr=…`),
 * the checkout — instead of always the home page.
 *
 * `ReturnPathTracker` records every non-auth page as it is visited, and the
 * login / register pages take it once auth succeeds. It lives in localStorage,
 * not in a `?returnTo=` param, so it survives the hops that drop query
 * strings: register → login, the Google OAuth round trip, and an email
 * verification link opened in a new tab.
 */

const STORAGE_KEY = 'auth_return_path';
/** Older than this, the customer has moved on; land them on the home page. */
const MAX_AGE_MS = 60 * 60 * 1000;

/** Pages that are part of signing in, never a place to come back to. */
const AUTH_PATH_PREFIXES = ['/login', '/register', '/forgot-password', '/auth'];

type StoredReturnPath = { path: string; savedAt: number };

function isAuthPath(pathname: string) {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Only an in-app path is followed: it must start with a single `/`, so a
 * tampered value like `//evil.com` or `https://…` can never redirect off-site.
 */
function isSafeReturnPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') && !isAuthPath(path.split(/[?#]/)[0]);
}

/** `?to=` values that name a screen instead of a branch. */
const NAMED_AUTH_TARGETS: Record<string, string> = { loyalty: '/rewards' };

/**
 * The page a `?to=` link sends the customer to once they are signed in, e.g.
 * a printed QR for `/register?to=loyalty` (the loyalty card) or
 * `/register?to=richmond` (that branch's storefront). Anything that is not a
 * named screen is taken as a branch slug. Null when absent or unusable.
 */
export function resolveAuthTarget(to: string | null): string | null {
  const value = to?.trim();
  if (!value) return null;
  const named = NAMED_AUTH_TARGETS[value.toLowerCase()];
  if (named) return named;
  // A branch slug is one path segment; anything else is not a branch link.
  if (/[/\\?#]/.test(value)) return null;
  return `/${encodeURIComponent(value)}`;
}

export function rememberReturnPath(path: string) {
  if (!isSafeReturnPath(path)) return;
  try {
    const value: StoredReturnPath = { path, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): fall back to the home page after auth.
  }
}

/** The page to land on after auth, `/` when none is recorded. Read once, then cleared. */
export function takeReturnPath(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    if (!raw) return '/';
    const { path, savedAt } = JSON.parse(raw) as StoredReturnPath;
    if (typeof path !== 'string' || !isSafeReturnPath(path)) return '/';
    if (typeof savedAt !== 'number' || Date.now() - savedAt > MAX_AGE_MS) return '/';
    return path;
  } catch {
    return '/';
  }
}
