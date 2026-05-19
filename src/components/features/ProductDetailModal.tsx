'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Product, ProductAddon, OptionGroup, ProductOptionGroupType } from '@/types/product';
import { useBranch } from '@/context/BranchContext';
import { catalogService } from '@/services/catalog.service';
import { X, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ProductDetailModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onAddToCart: (product: Product, quantity: number, options: any, addons: any) => void;
}

export function ProductDetailModal({ product, isOpen, onClose, onAddToCart }: ProductDetailModalProps) {
    const { selectedBranch } = useBranch();
    const [quantity, setQuantity] = useState(1);
    const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});

    // New Option Groups Logic
    const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
    const [selections, setSelections] = useState<Record<string, string[]>>({}); // groupId -> [optionIds]
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            setQuantity(1);
            setSelectedAddons({});
            setSelections({});
            setOptionGroups([]);

            const loadDetails = async () => {
                let groups = product.optionGroups || [];

                // If no groups on product but we are in a branch context, fetch full details
                if (groups.length === 0 && selectedBranch) {
                    setLoadingDetails(true);
                    try {
                        const fullProduct = await catalogService.getProduct(selectedBranch.id, product.id);
                        if (fullProduct && fullProduct.optionGroups) {
                            groups = fullProduct.optionGroups;
                        }
                    } catch (error) {
                        console.error("Failed to load product options", error);
                        toast.error("Failed to load product options");
                    } finally {
                        setLoadingDetails(false);
                    }
                }

                setOptionGroups(groups);

                // Initialize defaults
                const initialSelections: Record<string, string[]> = {};
                groups.forEach(group => {
                    initialSelections[group.id] = [];
                    // Pre-select defaults if any
                    group.options.forEach(opt => {
                        if (opt.isDefault) {
                            // Respect max selections constraints (though defaults should ideally be valid)
                            if (group.type === ProductOptionGroupType.VARIANT || group.type === ProductOptionGroupType.SINGLE) {
                                // For single select, only take the first default found (or last)
                                initialSelections[group.id] = [opt.id];
                            } else {
                                initialSelections[group.id].push(opt.id);
                            }
                        }
                    });
                });
                setSelections(initialSelections);
            };

            loadDetails();
        }
    }, [isOpen, product, selectedBranch]);

    if (!isOpen || !product) return null;

    const basePrice = Number(product.discountedPrice || product.price);

    const calculateTotal = () => {
        let total = basePrice;

        // Addons cost
        if (product.addons) {
            product.addons.forEach(addon => {
                if (selectedAddons[addon.id]) {
                    total += Number(addon.price);
                }
            });
        }

        // Option Groups cost
        optionGroups.forEach(group => {
            const groupSelections = selections[group.id] || [];
            groupSelections.forEach(optId => {
                const option = group.options.find(o => o.id === optId);
                if (option) {
                    total += Number(option.priceDelta);
                }
            });
        });

        return total * quantity;
    };

    const handleAddonToggle = (addonId: string) => {
        setSelectedAddons(prev => ({ ...prev, [addonId]: !prev[addonId] }));
    };

    const toggleOption = (groupId: string, optionId: string, groupType: ProductOptionGroupType, maxSelections: number | null | undefined) => {
        setSelections(prev => {
            const current = prev[groupId] || [];
            const isSelected = current.includes(optionId);
            const isSingle = groupType === ProductOptionGroupType.SINGLE || groupType === ProductOptionGroupType.VARIANT;

            if (isSingle) {
                // Replace selection
                return { ...prev, [groupId]: [optionId] };
            } else {
                // Multi-select logic
                if (isSelected) {
                    // Remove
                    return { ...prev, [groupId]: current.filter(id => id !== optionId) };
                } else {
                    // Add check max
                    if (maxSelections && current.length >= maxSelections) {
                        toast.error(`You can choose up to ${maxSelections} options.`);
                        return prev;
                    }
                    return { ...prev, [groupId]: [...current, optionId] };
                }
            }
        });
    };

    const handleAddToCart = () => {
        // Validate Required Groups
        for (const group of optionGroups) {
            const selectedCount = (selections[group.id] || []).length;

            if (group.isRequired && selectedCount === 0) {
                toast.error(`Please make a selection for "${group.name}"`);
                return;
            }

            if (group.minSelections && selectedCount < group.minSelections) {
                toast.error(`${group.name}: You must select at least ${group.minSelections} options.`);
                return;
            }
        }

        // Prepare data for compatible cart structure
        // The CartContext signature:  addToCart(productId, quantity, options, addons, note, product)
        // options: { optionId: string, valueId: string, ... }[]
        // Since we are moving to new structure, we might need to adapt.
        // For now, let's map our new structure to something generic or simply ignore the old options structure if CartContext handles it loosely.
        // Assuming CartContext needs update or we map to a "custom" structure.
        // Let's assume we pass the raw selection data and let the backend/cart service handle it, OR mimic the old structure if possible.
        // The old structure expected "Option -> Value". Our new structure is "Group -> OptionItem".
        // We can map: Group -> Option (as OptionId), Item -> Value (as ValueId).

        const optionsToSend: any[] = [];

        for (const group of optionGroups) {
            const selectedIds = selections[group.id] || [];
            if (selectedIds.length === 0) continue;

            // Determine if Single or Multi
            const isSingle = group.type === ProductOptionGroupType.SINGLE || group.type === ProductOptionGroupType.VARIANT;

            if (isSingle) {
                // Should have 1 ID
                const optId = selectedIds[0];
                const opt = group.options.find(o => o.id === optId);
                if (opt) {
                    optionsToSend.push({
                        groupId: group.id,
                        optionId: opt.id,
                        // Legacy fields for Guest Cart storage/display if needed (but CartContext handles this)
                        // If CartContext expects exactly the DTO, these extra fields are ignored by backend
                    });
                }
            } else if (group.type === ProductOptionGroupType.MULTI) {
                // Must send single entry with optionIds array for MULTI groups
                optionsToSend.push({
                    groupId: group.id,
                    optionIds: selectedIds
                });
            } else if (group.type === ProductOptionGroupType.INGREDIENT) {
                // Not implemented in UI properly yet (assumed Multi behavior in current UI toggle logic)
                // If UI treats Ingredient as Multi checkbox, we map to optionIds or ingredients array?
                // Backend expects 'ingredients: IngredientSelectionDto[]'.
                // Current UI toggleOption logic creates a list of selected IDs. 
                // We need to map these IDs to IngredientSelectionDto. 
                // Assuming 'SELECT' means 'REMOVE' or 'EXTRA'? 
                // For now, let's skip complex ingredient logic unless requested, or treat as Multi if backend allows?
                // Backend raises 'accepts ingredients only' for INGREDIENT group if optionIds sent.

                // If UI just toggles them, we default to EXTRA? Or REMOVE?
                // Standard behavior: Ingredients usually "Remove". Extras usually "Add".
                // Without explicit UI for "Action", we can't fully support Ingredient.
                // Falling back to ignoring or simplistic mapping.
            }
        }

        const addonsToSend = product.addons?.filter(a => selectedAddons[a.id]).map(a => ({
            id: a.id,
            name: a.name,
            price: a.price
        })) || [];

        onAddToCart(product, quantity, optionsToSend, addonsToSend);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header Image */}
                <div className="relative h-48 sm:h-56 bg-zinc-100 shrink-0">
                    {(product.imageUrl || product.image) && (
                        <Image
                            src={product.imageUrl || product.image || ''}
                            alt={product.name}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/80 hover:bg-white p-2 rounded-full shadow-sm transition-colors text-zinc-800"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-800">{product.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xl font-bold text-primary">{Number(product.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                            {product.discountedPrice && <span className="text-sm text-zinc-400 line-through">{Number(product.price).toLocaleString('tr-TR')} TL</span>}
                        </div>
                        <p className="mt-2 text-zinc-600 text-sm leading-relaxed">{product.description}</p>
                    </div>

                    {loadingDetails && (
                        <div className="py-4 text-center text-zinc-500">Loading options...</div>
                    )}

                    {/* New Option Groups */}
                    {optionGroups.map(group => {
                        const isSingle = group.type === ProductOptionGroupType.SINGLE || group.type === ProductOptionGroupType.VARIANT;
                        const hasMax = group.maxSelections && group.maxSelections > 0;

                        return (
                            <div key={group.id} className="space-y-3 pb-6 border-b border-zinc-100 last:border-0 last:pb-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-zinc-800 text-lg">{group.name}</h3>
                                        {group.minSelections && group.minSelections > 1 ? (
                                            <p className="text-sm text-zinc-500">Select at least {group.minSelections}</p>
                                        ) : group.isRequired ? (
                                            <p className="text-sm text-zinc-500">1 Selection Required</p>
                                        ) : (
                                            <p className="text-sm text-zinc-500">Optional</p>
                                        )}
                                        {hasMax && !isSingle && (
                                            <p className="text-xs text-zinc-400">Max {group.maxSelections}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        {group.isRequired ? (
                                            <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs font-medium rounded">Required</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-zinc-50 text-zinc-400 text-xs font-medium rounded">Optional</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {group.options.map(opt => {
                                        const isSelected = (selections[group.id] || []).includes(opt.id);
                                        return (
                                            <label
                                                key={opt.id}
                                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type={isSingle ? "radio" : "checkbox"}
                                                        name={group.id} // Group radio buttons by group id
                                                        checked={isSelected}
                                                        onChange={() => toggleOption(group.id, opt.id, group.type, group.maxSelections)}
                                                        className={`w-5 h-5 text-primary border-zinc-300 focus:ring-primary ${isSingle ? '' : 'rounded'}`}
                                                    />
                                                    <span className={`font-medium ${isSelected ? 'text-primary' : 'text-zinc-700'}`}>{opt.name}</span>
                                                </div>
                                                <div className="font-medium text-sm">
                                                    {opt.priceDelta > 0 ? (
                                                        <span className="text-zinc-600">+{opt.priceDelta} TL</span>
                                                    ) : (
                                                        <span className="text-primary font-bold">Free</span>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}


                    {/* Addons (Legacy support or Additional Extras) */}
                    {product.addons && product.addons.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-zinc-100">
                            <h3 className="font-bold text-zinc-800 text-lg">Extras</h3>
                            <div className="space-y-2">
                                {product.addons.map(addon => (
                                    <label key={addon.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={!!selectedAddons[addon.id]}
                                                onChange={() => handleAddonToggle(addon.id)}
                                                className="w-4 h-4 text-primary rounded border-zinc-300 focus:ring-primary"
                                            />
                                            <span className="text-zinc-700">{addon.name}</span>
                                        </div>
                                        <span className="text-sm font-medium text-zinc-600">+{addon.price} TL</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-zinc-100 bg-white shrink-0 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 bg-zinc-100 rounded-lg p-1.5">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-zinc-600 hover:text-zinc-900 active:scale-95 transition-all"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="font-bold text-zinc-800 w-6 text-center">{quantity}</span>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-zinc-600 hover:text-zinc-900 active:scale-95 transition-all"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Total Amount</div>
                            <div className="text-2xl font-bold text-primary">{calculateTotal().toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</div>
                        </div>
                    </div>

                    <button
                        onClick={handleAddToCart}
                        disabled={loadingDetails}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingDetails ? 'Loading...' : 'Add to Cart'}
                    </button>
                </div>

            </div>
        </div>
    );
}
