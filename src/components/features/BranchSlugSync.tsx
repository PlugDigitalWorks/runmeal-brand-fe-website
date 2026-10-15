'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBranch } from '@/context/BranchContext';
import { isBranchSelectable } from '@/lib/branch-details';

/**
 * Picks the branch named in the URL once the brand's branches are known. It
 * runs once per visit, so a later pick in the branch panel is not undone; a
 * slug that matches no pickable branch falls back to the plain storefront.
 */
export function BranchSlugSync({ slug }: { slug: string }) {
    const router = useRouter();
    const { branches, selectedBranch, selectBranch } = useBranch();
    const appliedRef = useRef(false);

    useEffect(() => {
        if (appliedRef.current || branches.length === 0) return;
        appliedRef.current = true;

        const branch = branches.find((candidate) => candidate.slug === slug);
        if (!branch || !isBranchSelectable(branch)) {
            router.replace('/');
            return;
        }
        if (selectedBranch?.id !== branch.id) selectBranch(branch);
    }, [branches, selectedBranch?.id, selectBranch, slug, router]);

    return null;
}
