'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCmsNavigation } from '@/context/CmsNavigationContext';
import { getCmsHref, isExternalNavigationItem, NavigationItem, NavigationNode } from '@/types/cms';

function NavLink({ item, className }: { item: NavigationItem; className?: string }) {
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

function NavItem({ node }: { node: NavigationNode }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const linkClass = 'text-sm font-medium text-zinc-700 hover:text-primary transition-colors';

    if (node.children.length === 0) {
        return <NavLink item={node} className={linkClass} />;
    }

    // Hover opens it for the mouse; the toggle keeps it reachable by keyboard and
    // on touch, where hover never fires.
    return (
        <div
            className="relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button
                type="button"
                onClick={() => setIsOpen((previous) => !previous)}
                aria-expanded={isOpen}
                className={`${linkClass} flex items-center gap-1`}
            >
                {node.title}
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute left-0 top-full z-20 min-w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                    <NavLink
                        item={node}
                        className="block px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-orange-50 hover:text-primary"
                    />
                    {node.children.map((child) => (
                        <NavLink
                            key={child.id}
                            item={child}
                            className="block px-4 py-2 text-sm text-zinc-600 hover:bg-orange-50 hover:text-primary"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function HeaderNavigation() {
    const { t } = useTranslation();
    const { header } = useCmsNavigation();

    if (header.length === 0) return null;

    return (
        <nav aria-label={t('cms.mainNavigation')} className="hidden items-center gap-6 md:flex">
            {header.map((node) => (
                <NavItem key={node.id} node={node} />
            ))}
        </nav>
    );
}
