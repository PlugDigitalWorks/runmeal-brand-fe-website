/**
 * Branch store — the branch the visitor is ordering from (picked, or pinned by
 * a QR table), for modules outside React. The BranchProvider writes it; the
 * auth service reads it so a sign-up records the branch it came from.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let currentBranchId: string | null = null;

export function getSelectedBranchId(): string | null {
  return currentBranchId;
}

export function setSelectedBranchId(branchId: string | null | undefined): void {
  currentBranchId = branchId && UUID.test(branchId) ? branchId : null;
}

/**
 * `x-branch-id` for a sign-up request, or nothing at all when no branch is
 * selected — never an empty, "null" or "undefined" header. The backend keeps
 * the branch if it belongs to this site's brand and ignores it otherwise.
 */
export function signupBranchHeaders(): Record<string, string> {
  return currentBranchId ? { 'x-branch-id': currentBranchId } : {};
}
