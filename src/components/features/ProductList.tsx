'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useBranch } from '@/context/BranchContext';
import { catalogService } from '@/services/catalog.service';
import { Category } from '@/types/category';
import { Product } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/constants';
import { getBrandId } from '@/lib/brand-store';
import { formatCurrency } from '@/lib/utils';
import { ProductDetailModal, type SelectedProductAddon, type SelectedProductOption } from './ProductDetailModal';

export function ProductList() {
    // `activeBranchId`, not `selectedBranch`: in a QR journey the branch is
    // known from the token immediately, while the full branch record needs a
    // session — and the branch menu endpoint is public either way.
    const {
        activeBranchId,
        menuRevision,
        availability,
        isAvailabilityLoading,
        hasAvailabilityError,
        refreshAvailability,
    } = useBranch();
    const { addToCart } = useCart();
    const { t } = useTranslation();
    const [categories, setCategories] = useState<Category[]>([]);
    // const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Drag to scroll refs
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const isDragging = React.useRef(false);
    const startX = React.useRef(0);
    const scrollLeft = React.useRef(0);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let menuData;
                if (activeBranchId) {
                    // Load Branch Menu
                    menuData = await catalogService.getBranchMenu(activeBranchId);
                } else {
                    // Load Brand Menu (Fallback or Default View)
                    menuData = await catalogService.getBrandMenu(getBrandId());
                }

                if (menuData) {
                    setCategories(menuData.categories || []);
                    // setProducts(menuData.products || []); // products are now in categories
                }
            } catch (error) {
                console.error("Failed to load catalog", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        // `menuRevision` changes when a cart/product validation error told us
        // the availability or prices we rendered are no longer what the
        // backend enforces.
    }, [activeBranchId, menuRevision]);



    // Drag Handlers
    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        isDragging.current = true;
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
        scrollContainerRef.current.style.cursor = 'grabbing';
    };

    const onMouseLeave = () => {
        isDragging.current = false;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };

    const onMouseUp = () => {
        isDragging.current = false;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 2; // Scroll-fast
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const handleProductClick = (product: Product) => {
        if (!activeBranchId) {
            toast.error(t('branch.selectToOrder'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (!availability?.canAcceptOrders) {
            toast.error(t('fulfillment.branchUnavailable'));
            return;
        }
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleAddToCartFromModal = async (
        product: Product,
        quantity: number,
        options: SelectedProductOption[],
        addons: SelectedProductAddon[],
        note?: string,
    ) => {
        await addToCart(
            product.id,
            quantity,
            options as unknown as Parameters<typeof addToCart>[2],
            addons,
            note,
            product,
        );
    };

    if (loading) return <div className="text-center py-10">{t('common.loading')}</div>;

    const canOrder = Boolean(activeBranchId && availability?.canAcceptOrders);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-zinc-100 min-h-[500px]">
            {activeBranchId && (isAvailabilityLoading || hasAvailabilityError || !availability?.canAcceptOrders) && (
                <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex items-center justify-between gap-4">
                        <span>
                            {isAvailabilityLoading
                                ? t('fulfillment.checkingAvailability')
                                : hasAvailabilityError
                                    ? t('fulfillment.availabilityError')
                                    : t('fulfillment.branchUnavailable')}
                        </span>
                        {!isAvailabilityLoading && (
                            <button type="button" onClick={() => void refreshAvailability()} className="font-semibold underline">
                                {t('fulfillment.retry')}
                            </button>
                        )}
                    </div>
                </div>
            )}
            {/* Category Tabs */}
            <div
                ref={scrollContainerRef}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
                className="border-b border-zinc-200 overflow-x-auto scrollbar-hide cursor-grab select-none"
            >
                <div className="flex p-4 gap-4 min-w-max">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-primary text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-primary hover:text-primary'}`}
                    >
                        {t('product.all')}
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-primary text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-primary hover:text-primary'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product List */}
            <div className="p-6 space-y-8">
                {selectedCategory ? (
                    <ProductSection
                        title={categories.find(c => c.id === selectedCategory)?.name || t('product.products')}
                        products={categories.find(c => c.id === selectedCategory)?.products || []}
                        onProductClick={handleProductClick}
                        isBranchSelected={canOrder}
                    />
                ) : categories.length > 0 ? (
                    categories.map(cat => {
                        const catProducts = cat.products || [];
                        if (catProducts.length === 0) return null;
                        return (
                            <ProductSection
                                key={cat.id}
                                title={cat.name}
                                products={catProducts}
                                onProductClick={handleProductClick}
                                isBranchSelected={canOrder}
                            />
                        );
                    })
                ) : (
                    <div className="text-center py-10 text-zinc-400">{t('product.noProducts')}</div>
                )}
            </div>

            <ProductDetailModal
                product={selectedProduct}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAddToCart={handleAddToCartFromModal}
                canAddToCart={canOrder}
            />
        </div>
    );
}

function ProductSection({ title, products, onProductClick, isBranchSelected }: { title: string, products: Product[], onProductClick: (p: Product) => void, isBranchSelected: boolean }) {
    return (
        <div>
            <h3 className="text-lg font-bold text-zinc-800 mb-4 pb-2 border-b border-zinc-100">{title}</h3>
            <div className="space-y-4">
                {products.map(product => (
                    <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-zinc-50 p-2 rounded transition-colors gap-4">
                        <div className="flex items-start gap-4 flex-1">
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => onProductClick(product)}
                                    disabled={!isBranchSelected}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${!isBranchSelected ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'}`}
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                            <div className="w-16 h-12 bg-zinc-100 rounded overflow-hidden relative shrink-0">
                                {(product.imageUrl || product.image) ? (
                                    <Image
                                        src={product.imageUrl || product.image || ''}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <Image
                                        src={DEFAULT_PRODUCT_IMAGE}
                                        alt={product.name}
                                        fill
                                        className="object-contain p-1.5 opacity-90"
                                    />
                                )}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-zinc-800 break-words">{product.name}</h4>
                                <p className="text-xs text-zinc-500 line-clamp-2 break-words">{product.description}</p>
                            </div>
                        </div>
                        <div className="font-bold text-zinc-800 whitespace-nowrap ml-14 sm:ml-4 text-right sm:text-left">
                            {formatCurrency(product.price, product.currencySymbol)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
