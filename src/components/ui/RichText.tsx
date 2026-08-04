'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';

let isHookRegistered = false;

/**
 * A CMS author can open a link in a new tab, and `target="_blank"` without
 * `rel="noopener"` hands the opened page a handle back to ours.
 */
function registerLinkHardening() {
    if (isHookRegistered || typeof window === 'undefined') return;
    isHookRegistered = true;

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.nodeName === 'A' && node.getAttribute('target') === '_blank') {
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });
}

/**
 * Renders CMS authored HTML.
 *
 * The backend already sanitizes this content; purifying again here is the second
 * layer, so a gap on either side is not enough on its own to land script or
 * event-handler attributes in the page. Every CMS string must go through this
 * component rather than `dangerouslySetInnerHTML` at the call site.
 */
export function RichText({ html, className = '' }: { html: string; className?: string }) {
    const safeHtml = useMemo(() => {
        // DOMPurify needs a DOM. CMS content only ever arrives from a client-side
        // fetch, so this is empty during prerender and there is nothing to lose.
        if (typeof window === 'undefined' || !html) return '';

        registerLinkHardening();

        return DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            ADD_ATTR: ['target', 'rel'],
        });
    }, [html]);

    if (!safeHtml) return null;

    return (
        <div
            className={`text-zinc-700 leading-relaxed
                [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-zinc-900
                [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-zinc-900
                [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-900
                [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0
                [&_p]:mb-4 [&_p:last-child]:mb-0
                [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6
                [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6
                [&_li]:mb-1
                [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-80
                [&_strong]:font-semibold [&_strong]:text-zinc-900
                [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-200 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-600
                [&_hr]:my-6 [&_hr]:border-zinc-200
                [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg
                [&_table]:my-4 [&_table]:w-full [&_table]:text-sm
                [&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:p-2 [&_th]:text-left
                [&_td]:border [&_td]:border-zinc-200 [&_td]:p-2
                ${className}`}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
    );
}
