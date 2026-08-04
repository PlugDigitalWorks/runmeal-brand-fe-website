'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

import { cmsService } from '@/services/cms.service';
import { buildNavigationTree, CmsNavigation, NavigationNode } from '@/types/cms';
import { useBrand } from './BrandContext';

interface CmsNavigationContextType {
    header: NavigationNode[];
    footer: NavigationNode[];
    isLoading: boolean;
}

const EMPTY_NAVIGATION: CmsNavigation = { header: [], footer: [] };

const CmsNavigationContext = createContext<CmsNavigationContextType | undefined>(undefined);

/**
 * Header and footer links for the brand this storefront serves.
 *
 * Fetched once per resolved brand: keying the effect on `brandId` is what stops
 * one brand's menu from being reused for another after a tenant change.
 */
export function CmsNavigationProvider({ children }: { children: React.ReactNode }) {
    const { brand } = useBrand();
    const brandId = brand?.brandId;
    const [navigation, setNavigation] = useState<CmsNavigation>(EMPTY_NAVIGATION);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isCurrent = true;

        cmsService
            .getNavigation()
            .then((result) => {
                if (isCurrent) setNavigation(result);
            })
            .catch((error) => {
                // A brand without CMS pages is normal, and a failed menu must never
                // take the storefront down — render without the extra links.
                console.error('Failed to fetch CMS navigation', error);
                if (isCurrent) setNavigation(EMPTY_NAVIGATION);
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [brandId]);

    const value = React.useMemo(
        () => ({
            header: buildNavigationTree(navigation.header),
            footer: buildNavigationTree(navigation.footer),
            isLoading,
        }),
        [navigation, isLoading],
    );

    return <CmsNavigationContext.Provider value={value}>{children}</CmsNavigationContext.Provider>;
}

export function useCmsNavigation() {
    const context = useContext(CmsNavigationContext);
    if (context === undefined) {
        throw new Error('useCmsNavigation must be used within a CmsNavigationProvider');
    }
    return context;
}
