import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import type { Tag } from '@/types/tag';

/** Tags without repeats, keeping the first of each (a product's own before inherited). */
export function uniqueTags<T extends Tag>(tags: T[] | undefined): T[] {
  const seen = new Set<string>();
  return (tags ?? []).filter((tag) => {
    if (seen.has(tag.id)) return false;
    seen.add(tag.id);
    return true;
  });
}

export const productHasTag = (product: Product, tagId: string) =>
  !!product.tags?.some((tag) => tag.id === tagId);

/** The tags any product carries, for the menu's quick filters, in display order. */
export function collectProductTags(categories: Category[]): Tag[] {
  return uniqueTags(categories.flatMap((category) => (category.products ?? []).flatMap((p) => p.tags ?? []))).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/**
 * The menu narrowed to products carrying `tagId`, across categories. Categories
 * left without products are dropped; without a tag every category stays.
 */
export function filterMenuByTag(categories: Category[], tagId: string | null): Category[] {
  if (!tagId) return categories;
  return categories
    .map((category) => ({
      ...category,
      products: (category.products ?? []).filter((product) => productHasTag(product, tagId)),
    }))
    .filter((category) => category.products.length > 0);
}
