import { describe, expect, it } from 'vitest';

import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import type { ProductTag } from '@/types/tag';
import { tagName } from '@/types/tag';
import { collectProductTags, filterMenuByTag, uniqueTags } from './menu-tags';

const tag = (id: string, sortOrder: number, source: ProductTag['source'] = 'product'): ProductTag => ({
    id,
    kind: 'product',
    group: null,
    slug: id,
    name: { tr: `${id}-tr`, en: `${id}-en` },
    icon: null,
    sortOrder,
    source,
});

const vegan = tag('vegan', 1);
const spicy = tag('spicy', 0);

const product = (id: string, tags: ProductTag[] = []): Product => ({
    id,
    categoryId: 'c',
    branchId: 'b',
    name: id,
    description: '',
    price: 1,
    isActive: true,
    tags,
});

const categories: Category[] = [
    { id: 'burgers', name: 'Burgers', products: [product('beef', [spicy]), product('garden', [vegan])] },
    { id: 'salads', name: 'Salads', products: [product('caesar', [{ ...vegan, source: 'category' }])] },
    { id: 'drinks', name: 'Drinks', products: [product('cola')] },
];

describe('filterMenuByTag', () => {
    it('keeps every category without a tag', () => {
        expect(filterMenuByTag(categories, null)).toBe(categories);
    });

    it('keeps products carrying the tag, own or inherited, and drops empty categories', () => {
        const filtered = filterMenuByTag(categories, 'vegan');

        expect(filtered.map((c) => [c.id, c.products?.map((p) => p.id)])).toEqual([
            ['burgers', ['garden']],
            ['salads', ['caesar']],
        ]);
    });
});

describe('collectProductTags', () => {
    it('lists each tag on the menu once, in display order', () => {
        expect(collectProductTags(categories).map((t) => t.id)).toEqual(['spicy', 'vegan']);
    });
});

describe('uniqueTags', () => {
    it("keeps a product's own tag before the inherited copy", () => {
        expect(uniqueTags([vegan, { ...vegan, source: 'category' }])).toEqual([vegan]);
    });
});

describe('tagName', () => {
    it('picks the name in the given language', () => {
        expect(tagName(vegan, 'en')).toBe('vegan-en');
        expect(tagName(vegan, 'tr')).toBe('vegan-tr');
    });
});
