import { Storefront } from "@/components/features/Storefront";

/**
 * A branch's own storefront link, e.g. `brand.runmeal.com/richmond`. The
 * branch is matched in the browser, because the brand is resolved from the
 * storefront domain by the edge Worker and is not known while rendering on
 * the server. Static routes (`/login`, `/orders`, …) take precedence over a
 * branch slug of the same name.
 */
export default async function BranchStorefrontPage({ params }: { params: Promise<{ branchSlug: string }> }) {
    const { branchSlug } = await params;

    return <Storefront branchSlug={decodeURIComponent(branchSlug)} />;
}
