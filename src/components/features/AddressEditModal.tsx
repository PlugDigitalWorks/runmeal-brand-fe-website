'use client';

import { X } from 'lucide-react';
import { Address } from '@/types/address';
import { AddressForm } from '@/components/features/address/AddressForm';
import { useTranslation } from 'react-i18next';

interface AddressEditModalProps {
    address?: Address;
    onClose: () => void;
    onSave: () => Promise<void>;
}

/** Checkout's add / edit address dialog: the same form as the profile page. */
export function AddressEditModal({ address, onClose, onSave }: AddressEditModalProps) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 flex-shrink-0">
                    <h2 className="text-lg font-bold text-zinc-800">
                        {address?.id ? t('address.editDeliveryAddress') : t('address.addNewAddress')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-100 rounded transition-colors"
                    >
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>
                <div className="p-4">
                    <AddressForm address={address} onCancel={onClose} onSuccess={onSave} />
                </div>
            </div>
        </div>
    );
}
