'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FileQuestion } from 'lucide-react';

import { ContactForm } from '@/components/features/ContactForm';
import { RichText } from '@/components/ui/RichText';
import { useBranch } from '@/context/BranchContext';
import { useBrand } from '@/context/BrandContext';
import { cmsService } from '@/services/cms.service';
import { PublicContentPage } from '@/types/cms';

type LoadState = 'loading' | 'ready' | 'notFound' | 'error';

/**
 * SEO tags for the page. React hoists these into <head>, which is the only way
 * to set them here: the brand — and therefore the page — is resolved in the
 * browser, so `generateMetadata` on the server has nothing to work with.
 */
function CmsPageMetadata({ page }: { page: PublicContentPage }) {
    return (
        <>
            <title>{page.seoTitle || page.title}</title>
            {page.seoDescription && <meta name="description" content={page.seoDescription} />}
            {page.seoKeywords.length > 0 && (
                <meta name="keywords" content={page.seoKeywords.join(', ')} />
            )}
        </>
    );
}

export function CmsPageView({ slug }: { slug: string }) {
    const { t } = useTranslation();
    const { brand } = useBrand();
    const { selectedBranch } = useBranch();
    // Cached per brand and slug, so a tenant change or a new slug never shows the
    // page we loaded last. Keeping the key in state is also what makes `loading`
    // a derived value rather than another setState inside the effect.
    const cacheKey = `${brand?.brandId ?? ''}:${slug}`;
    const [result, setResult] = useState<{
        key: string;
        page: PublicContentPage | null;
        state: Exclude<LoadState, 'loading'>;
    } | null>(null);

    useEffect(() => {
        let isCurrent = true;

        cmsService
            .getPage(slug)
            .then((page) => {
                if (isCurrent) setResult({ key: cacheKey, page, state: 'ready' });
            })
            .catch((error: unknown) => {
                if (!isCurrent) return;
                const status = (error as { response?: { status?: number } })?.response?.status;
                // 404 covers a missing slug, an inactive page and an inactive
                // ancestor alike — we must not tell the three apart.
                if (status !== 404) {
                    console.error(`Failed to fetch CMS page ${slug}`, error);
                }
                setResult({ key: cacheKey, page: null, state: status === 404 ? 'notFound' : 'error' });
            });

        return () => {
            isCurrent = false;
        };
    }, [slug, cacheKey]);

    const current = result?.key === cacheKey ? result : null;
    const state: LoadState = current?.state ?? 'loading';
    const page = current?.page ?? null;

    if (state === 'loading') {
        return (
            <div className="flex items-center justify-center gap-3 py-20 text-sm text-zinc-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t('cms.loading')}
            </div>
        );
    }

    if (state === 'notFound' || state === 'error') {
        const isNotFound = state === 'notFound';

        return (
            <div className="mx-auto max-w-lg py-20 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-primary">
                    <FileQuestion size={22} />
                </span>
                <h1 className="mt-4 text-xl font-bold text-zinc-800">
                    {isNotFound ? t('cms.notFound.title') : t('cms.error.title')}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    {isNotFound ? t('cms.notFound.description') : t('cms.error.description')}
                </p>
                <Link
                    href="/"
                    className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                    {t('cms.backHome')}
                </Link>
            </div>
        );
    }

    if (!page) return null;

    return (
        <>
            <CmsPageMetadata page={page} />

            <article className="mx-auto max-w-3xl">
                <h1 className="mb-6 text-3xl font-bold text-zinc-900">{page.title}</h1>
                <RichText html={page.content} />

                {/* `contact_form` means: this copy introduces the contact form. */}
                {page.type === 'contact_form' && (
                    <div className="mt-8">
                        {selectedBranch ? (
                            <ContactForm
                                branchId={selectedBranch.id}
                                branchName={selectedBranch.name}
                                brandId={brand?.brandId}
                            />
                        ) : (
                            <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center">
                                <p className="text-sm text-zinc-500">{t('contact.noBranch.description')}</p>
                                <Link
                                    href="/"
                                    className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                                >
                                    {t('contact.noBranch.action')}
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </article>
        </>
    );
}
