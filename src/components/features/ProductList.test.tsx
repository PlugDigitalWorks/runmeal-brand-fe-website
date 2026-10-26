import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogService } from '@/services/catalog.service';
import type { Category } from '@/types/category';
import type { Product } from '@/types/product';
import type { ProductTag } from '@/types/tag';
import { ProductList } from './ProductList';

const stable = vi.hoisted(() => ({
    brand: { brand: { language: 'en' as 'en' | 'tr' } },
    branch: {
        activeBranchId: 'branch-1',
        menuRevision: 0,
        availability: { canAcceptOrders: true },
        isAvailabilityLoading: false,
        hasAvailabilityError: false,
        refreshAvailability: vi.fn(),
        hasNoOrderTypes: false,
    },
    cart: { addToCart: vi.fn() },
}));

vi.mock('next/image', () => ({
    // eslint-disable-next-line @next/next/no-img-element
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/context/BrandContext', () => ({ useBrand: () => stable.brand }));
vi.mock('@/context/BranchContext', () => ({ useBranch: () => stable.branch }));
vi.mock('@/context/CartContext', () => ({ useCart: () => stable.cart }));
vi.mock('@/services/catalog.service', () => ({
    catalogService: { getBranchMenu: vi.fn(), getBrandMenu: vi.fn(), getProduct: vi.fn() },
}));

const tag = (id: string, en: string, tr: string, sortOrder: number, icon: string | null = null): ProductTag => ({
    id,
    kind: 'product',
    group: null,
    slug: id,
    name: { tr, en },
    icon,
    sortOrder,
    source: 'product',
});

const vegan = tag('vegan', 'Vegan', 'Vegan', 0, 'leaf');
const spicy = tag('spicy', 'Spicy', 'Acılı', 1, 'flame');
const glutenFree = tag('gluten-free', 'Gluten-free', 'Glutensiz', 2, 'not-a-known-icon');

const product = (id: string, categoryId: string, tags: ProductTag[] = []): Product => ({
    id,
    categoryId,
    branchId: 'branch-1',
    name: `Product ${id}`,
    description: `About ${id}`,
    price: 10,
    isActive: true,
    tags,
});

const categories: Category[] = [
    { id: 'burgers', name: 'Burgers', products: [product('beef', 'burgers', [spicy]), product('garden', 'burgers', [vegan, spicy])] },
    {
        id: 'salads',
        name: 'Salads',
        tags: [vegan],
        products: [product('caesar', 'salads', [{ ...vegan, source: 'category' }, glutenFree])],
    },
    { id: 'drinks', name: 'Drinks', products: [product('cola', 'drinks')] },
];

const badgeTexts = (container: HTMLElement) =>
    within(container).queryAllByTestId('tag-badge').map((el) => el.textContent);
const productRow = (name: string) => screen.getByText(name).closest('.group') as HTMLElement;

describe('<ProductList /> tags', () => {
    beforeEach(() => {
        stable.brand.brand.language = 'en';
        vi.mocked(catalogService.getBranchMenu).mockResolvedValue({ brandId: 'brand-1', categories });
    });

    it('shows product tags (own and inherited) as badges, read from tag objects', async () => {
        render(<ProductList />);

        expect(badgeTexts(await screen.findByText('Product garden').then(() => productRow('Product garden')))).toEqual([
            'Vegan',
            'Spicy',
        ]);
        expect(badgeTexts(productRow('Product caesar'))).toEqual(['Vegan', 'Gluten-free']);
        expect(badgeTexts(productRow('Product cola'))).toEqual([]);
    });

    it('draws icons only for known icon keys', async () => {
        render(<ProductList />);
        await screen.findByText('Product caesar');

        const [veganBadge, glutenFreeBadge] = within(productRow('Product caesar')).getAllByTestId('tag-badge');
        expect(veganBadge.querySelector('svg')).not.toBeNull();
        expect(glutenFreeBadge.querySelector('svg')).toBeNull();
    });

    it("names tags in the brand's language", async () => {
        stable.brand.brand.language = 'tr';

        render(<ProductList />);

        await screen.findByText('Product beef');
        expect(badgeTexts(productRow('Product beef'))).toEqual(['Acılı']);
    });

    it('shows the category tags in its header', async () => {
        render(<ProductList />);

        const salads = await screen.findByRole('region', { name: 'Salads' });
        const header = within(salads).getByRole('heading', { name: 'Salads' }).parentElement as HTMLElement;
        expect(badgeTexts(header)).toEqual(['Vegan']);
    });

    it('quick-filters by a tag across categories and hides the categories left empty', async () => {
        render(<ProductList />);

        const quickFilters = await screen.findByRole('group');
        expect(within(quickFilters).getAllByRole('button').map((b) => b.textContent)).toEqual([
            'Vegan',
            'Spicy',
            'Gluten-free',
        ]);

        fireEvent.click(within(quickFilters).getByRole('button', { name: 'Vegan' }));

        expect(within(screen.getByRole('region', { name: 'Burgers' })).queryByText('Product beef')).not.toBeInTheDocument();
        expect(screen.getByText('Product garden')).toBeInTheDocument();
        expect(screen.getByText('Product caesar')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Drinks' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Drinks' })).not.toBeInTheDocument();

        fireEvent.click(within(quickFilters).getByRole('button', { name: 'Vegan', pressed: true }));

        expect(screen.getByRole('region', { name: 'Drinks' })).toBeInTheDocument();
        expect(screen.getByText('Product beef')).toBeInTheDocument();
    });

    it('shows every tag in the product detail', async () => {
        vi.mocked(catalogService.getProduct).mockResolvedValue(categories[1].products![0]);
        render(<ProductList />);

        fireEvent.click(await screen.findByText('Product caesar'));

        const detail = (await screen.findByRole('heading', { level: 2, name: 'Product caesar' })).parentElement as HTMLElement;
        expect(badgeTexts(detail)).toEqual(['Vegan', 'Gluten-free']);
    });
});
