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

/** `branch` is the slug of a `?branch=` link: the branch a sign-up records. */
type StoredReturnPath = { path: string; savedAt: number; branch?: string };

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
const NAMED_AUTH_TARGETS: Record<string, string> = { loyalty: '/loyalty' };

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

/**
 * The branch a `?branch=` link signs the customer up for, as a lowercase slug:
 * `/register?to=loyalty&branch=richmond` lands on the loyalty card and records
 * Richmond. One path segment, like a branch link. Null when absent or unusable.
 */
export function resolveAuthBranch(branch: string | null): string | null {
  const value = branch?.trim().toLowerCase();
  if (!value || /[/\\?#]/.test(value)) return null;
  return value;
}

/**
 * `branchSlug` rides along with the path and shares its life: it is dropped
 * when the path is taken, goes stale, or is replaced by the next page visited.
 */
export function rememberReturnPath(path: string, branchSlug?: string | null) {
  if (!isSafeReturnPath(path)) return;
  try {
    const value: StoredReturnPath = { path, savedAt: Date.now(), ...(branchSlug ? { branch: branchSlug } : {}) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): fall back to the home page after auth.
  }
}

/** The stored record without clearing it, or null when none is recorded or it is stale. */
function peekStored(): StoredReturnPath | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredReturnPath;
    if (typeof stored.path !== 'string' || !isSafeReturnPath(stored.path)) return null;
    if (typeof stored.savedAt !== 'number' || Date.now() - stored.savedAt > MAX_AGE_MS) return null;
    return stored;
  } catch {
    return null;
  }
}

/** The recorded page without clearing it, or null when none is recorded or it is stale. */
export function peekReturnPath(): string | null {
  return peekStored()?.path ?? null;
}

/** The slug of the `?branch=` link the customer came through, if any. */
export function peekReturnBranchSlug(): string | null {
  const branch = peekStored()?.branch;
  return typeof branch === 'string' ? resolveAuthBranch(branch) : null;
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
