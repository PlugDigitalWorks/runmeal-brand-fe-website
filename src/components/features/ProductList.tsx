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
import { DEFAULT_BRAND_ID } from '@/lib/constants';
import { ProductDetailModal } from './ProductDetailModal';

export function ProductList() {
    const { selectedBranch } = useBranch();
    const { addToCart } = useCart();
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
                if (selectedBranch) {
                    // Load Branch Menu
                    menuData = await catalogService.getBranchMenu(selectedBranch.id);
                } else {
                    // Load Brand Menu (Fallback or Default View)
                    menuData = await catalogService.getBrandMenu(DEFAULT_BRAND_ID);
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
    }, [selectedBranch]);



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
        if (!selectedBranch) {
            toast.error("Please select a branch to order.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleAddToCartFromModal = async (product: Product, quantity: number, options: any, addons: any) => {
        await addToCart(product.id, quantity, options, addons, undefined, product);
        toast.success("Added to cart");
    };

    if (loading) return <div className="text-center py-10">Loading...</div>;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-zinc-100 min-h-[500px]">
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
                        All
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
                        title={categories.find(c => c.id === selectedCategory)?.name || 'Products'}
                        products={categories.find(c => c.id === selectedCategory)?.products || []}
                        onProductClick={handleProductClick}
                        isBranchSelected={!!selectedBranch}
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
                                isBranchSelected={!!selectedBranch}
                            />
                        );
                    })
                ) : (
                    <div className="text-center py-10 text-zinc-400">No products found.</div>
                )}
            </div>

            <ProductDetailModal
                product={selectedProduct}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAddToCart={handleAddToCartFromModal}
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
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${!isBranchSelected ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'}`}
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                            {(product.imageUrl || product.image) && (
                                <div className="w-16 h-12 bg-zinc-100 rounded overflow-hidden relative shrink-0">
                                    <Image
                                        src={product.imageUrl || product.image || ''}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                            )}
                            <div className="min-w-0">
                                <h4 className="font-bold text-zinc-800 break-words">{product.name}</h4>
                                <p className="text-xs text-zinc-500 line-clamp-2 break-words">{product.description}</p>
                            </div>
                        </div>
                        <div className="font-bold text-zinc-800 whitespace-nowrap ml-14 sm:ml-4 text-right sm:text-left">
                            {Number(product.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
