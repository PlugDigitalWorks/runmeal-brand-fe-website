'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { useCmsNavigation } from '@/context/CmsNavigationContext';
import { getCmsHref, isExternalNavigationItem, NavigationItem } from '@/types/cms';

function FooterLink({ item, className }: { item: NavigationItem; className?: string }) {
    const href = getCmsHref(item);

    // External targets leave the app, so they get a plain anchor rather than the
    // client router, plus the usual hardening.
    if (isExternalNavigationItem(item)) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {item.title}
            </a>
        );
    }

    return (
        <Link href={href} className={className}>
            {item.title}
        </Link>
    );
}

export function Footer() {
    const { t } = useTranslation();
    const { footer } = useCmsNavigation();

    // A brand with no CMS footer pages should not get an empty bar.
    if (footer.length === 0) return null;

    return (
        <footer className="mt-auto border-t border-zinc-100 bg-white">
            <div className="container mx-auto px-4 py-8">
                <nav aria-label={t('cms.footerNavigation')}>
                    <ul className="flex flex-wrap gap-x-8 gap-y-6">
                        {footer.map((node) => (
                            <li key={node.id} className="min-w-[8rem]">
                                <FooterLink
                                    item={node}
                                    className="text-sm font-semibold text-zinc-900 hover:text-primary transition-colors"
                                />
                                {node.children.length > 0 && (
                                    <ul className="mt-2 space-y-1.5">
                                        {node.children.map((child) => (
                                            <li key={child.id}>
                                                <FooterLink
                                                    item={child}
                                                    className="text-sm text-zinc-500 hover:text-primary transition-colors"
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </footer>
    );
}
