import { CmsPageView } from './CmsPageView';

/**
 * Generic CMS route. The page itself is fetched in the browser, because the
 * brand is resolved from the storefront domain by the edge Worker and is not
 * available while rendering on the server.
 */
export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    return <CmsPageView slug={decodeURIComponent(slug)} />;
}
