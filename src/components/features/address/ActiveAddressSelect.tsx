'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ChevronDown, MapPin, Plus, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useUser } from '@/context/UserContext';
import { userService } from '@/services/user.service';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import type { Address } from '@/types/address';

function streetLine(address: Address) {
    const apartment = address.apartmentNumber && address.apartmentNumber !== '-' ? ` / ${address.apartmentNumber}` : '';
    return `${address.street}, ${address.buildingNumber}${apartment}`;
}

/**
 * Header dropdown that switches the customer's active delivery address.
 * Branch distances and delivery checks are measured from the active address,
 * so `BranchContext` reloads the branches once the address list refreshes.
 */
export function ActiveAddressSelect() {
    const { t } = useTranslation();
    const { addresses, refreshAddresses } = useUser();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isChanging, setIsChanging] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const activeAddress = addresses.find((address) => address.isActive);

    React.useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const select = async (address: Address) => {
        if (isChanging) return;
        if (address.id === activeAddress?.id) {
            setIsOpen(false);
            return;
        }

        setIsChanging(true);
        try {
            await userService.setActiveAddress(address.id);
            await refreshAddresses();
            setIsOpen(false);
            toast.success(t('checkout.toast.addressSelected'));
        } catch (error: unknown) {
            console.error('Failed to change active address', error);
            toast.error(resolveApiErrorMessage(error, t('checkout.toast.addressSelectionFailed')));
        } finally {
            setIsChanging(false);
        }
    };

    const label = activeAddress ? streetLine(activeAddress) : t('address.selectActiveAddress');

    return (
        <div className="relative min-w-0" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={t('address.activeAddress')}
                title={activeAddress ? `${streetLine(activeAddress)} · ${activeAddress.district}, ${activeAddress.province}` : label}
                className="flex min-w-0 items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-primary hover:text-primary sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-sm"
            >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                <span className="hidden max-w-[220px] truncate sm:inline">{label}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
                    <div className="border-b border-zinc-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {t('address.activeAddress')}
                    </div>

                    {addresses.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-zinc-500">{t('address.noSavedAddress')}</p>
                    ) : (
                        <ul role="listbox" aria-label={t('address.activeAddress')} className="max-h-72 overflow-y-auto">
                            {addresses.map((address) => {
                                const isSelected = address.id === activeAddress?.id;
                                return (
                                    <li key={address.id} role="option" aria-selected={isSelected}>
                                        <button
                                            type="button"
                                            onClick={() => select(address)}
                                            disabled={isChanging}
                                            className={`flex w-full items-start gap-3 border-b border-zinc-50 px-4 py-3 text-left text-sm last:border-0 ${
                                                isSelected ? 'bg-orange-50' : 'hover:bg-orange-50/60'
                                            } ${isChanging ? 'cursor-wait opacity-70' : ''}`}
                                        >
                                            <MapPin size={16} className={`mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-zinc-400'}`} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-medium text-zinc-800">{streetLine(address)}</span>
                                                <span className="block truncate text-xs text-zinc-500">
                                                    {address.district}, {address.province}
                                                </span>
                                            </span>
                                            {isSelected && <Check size={16} className="mt-0.5 shrink-0 text-primary" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <div className="flex border-t border-zinc-100 text-sm">
                        <Link
                            href="/profile?tab=addresses&action=new"
                            onClick={() => setIsOpen(false)}
                            className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 font-medium text-primary hover:bg-orange-50"
                        >
                            <Plus size={14} />
                            {t('address.addNewAddress')}
                        </Link>
                        {addresses.length > 0 && (
                            <Link
                                href="/profile?tab=addresses"
                                onClick={() => setIsOpen(false)}
                                className="flex flex-1 items-center justify-center gap-1.5 border-l border-zinc-100 px-3 py-2.5 font-medium text-zinc-600 hover:bg-zinc-50"
                            >
                                <Settings2 size={14} />
                                {t('address.manageAddresses')}
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
