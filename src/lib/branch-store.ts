/**
 * Branch store — the branch a sign-up records, for modules outside React. The
 * BranchProvider writes the selected branch (picked, or pinned by a QR table)
 * and the brand's branches; the auth service reads it so a new account
 * records the branch it came from.
 */
import { peekReturnPath } from '@/lib/return-path';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type KnownBranch = { id: string; slug?: string | null };

let currentBranchId: string | null = null;
let knownBranches: KnownBranch[] = [];

export function getSelectedBranchId(): string | null {
  return currentBranchId;
}

export function setSelectedBranchId(branchId: string | null | undefined): void {
  currentBranchId = branchId && UUID.test(branchId) ? branchId : null;
}

/** The brand's branches, to tell a branch link (`/richmond`) from other pages. */
export function setKnownBranches(branches: KnownBranch[]): void {
  knownBranches = branches;
}

/**
 * The branch the customer will land on after signing up: a `?to=<slug>` QR
 * link or the storefront they left are stored as the return path, which is a
 * branch link for everything but named screens like `/loyalty`. Matched
 * against the brand's branches (case-insensitive, like `BranchSlugSync`), so
 * any other page names no branch.
 */
function returnPathBranchId(): string | null {
  const path = peekReturnPath();
  if (!path) return null;
  const segment = path.split(/[?#]/)[0].slice(1);
  if (!segment || segment.includes('/')) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(segment).toLowerCase();
  } catch {
    return null;
  }
  const branch = knownBranches.find((candidate) => candidate.slug?.toLowerCase() === slug);
  return branch && UUID.test(branch.id) ? branch.id : null;
}

/**
 * `x-branch-id` for a sign-up request: the branch the customer is signing up
 * for (see `returnPathBranchId`), else the selected one, else no header at all
 * — never an empty, "null" or "undefined" one. The backend keeps the branch
 * if it belongs to this site's brand and ignores it otherwise.
 */
export function signupBranchHeaders(): Record<string, string> {
  const branchId = returnPathBranchId() ?? currentBranchId;
  return branchId ? { 'x-branch-id': branchId } : {};
}
