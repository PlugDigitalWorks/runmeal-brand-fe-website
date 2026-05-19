'use client';

import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Address, UpdateAddressDto } from '@/types/address';
import { userService } from '@/services/user.service';
import { toast } from 'sonner';
import { LocationPicker, GeocodedAddress, AddressComponent, Location } from '@/components/features/address/LocationPicker';

interface AddressEditModalProps {
    address?: Address;
    onClose: () => void;
    onSave: () => void;
}

export function AddressEditModal({ address, onClose, onSave }: AddressEditModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        street: address?.street || '',
        buildingNumber: address?.buildingNumber || '',
        apartmentNumber: address?.apartmentNumber || '',
        district: address?.district || '',
        province: address?.province || '',
        postalCode: address?.postalCode || '',
        latitude: address?.latitude || 41.0082, // Default to Istanbul if missing
        longitude: address?.longitude || 28.9784,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleLocationChange = (location: Location) => {
        setFormData(prev => ({
            ...prev,
            latitude: location.latitude,
            longitude: location.longitude
        }));
    };

    const handleAddressSelect = useCallback((geocodedAddress: GeocodedAddress) => {
        const components = geocodedAddress.address_components;
        const getComponent = (type: string) => components.find((c: AddressComponent) => c.types.includes(type))?.long_name || '';

        const administrativeAreaLevel1 = getComponent('administrative_area_level_1'); // Province/City usually
        const administrativeAreaLevel2 = getComponent('administrative_area_level_2');
        const locality = getComponent('locality'); // District usually
        const sublocality = getComponent('sublocality');
        const postalCode = getComponent('postal_code');
        const route = getComponent('route');
        const streetNumber = getComponent('street_number');

        // Logic to map Google Maps components to our fields
        // This maps roughly to what typical Turkish addresses expect + generic fallback

        // In Turkey:
        // administrative_area_level_1 -> Istanbul (Province)
        // administrative_area_level_2 -> Fatih (District sometimes)
        // locality -> Fatih (District) or Istanbul

        let district = locality;
        // If locality matches province or is empty, try other fields
        if (!district || district === administrativeAreaLevel1) {
            district = administrativeAreaLevel2 || sublocality;
        }

        const province = administrativeAreaLevel1;

        setFormData(prev => ({
            ...prev,
            street: route || prev.street,
            buildingNumber: streetNumber || prev.buildingNumber,
            postalCode: postalCode || prev.postalCode,
            district: district || prev.district,
            province: province || prev.province,
        }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsLoading(true);
        try {
            if (address?.id) {
                // Update existing
                await userService.updateAddress(address.id, {
                    ...formData,
                    countryCode: address.countryCode || 'TR',
                    isActive: true
                } as UpdateAddressDto);
            } else {
                // Create new
                await userService.createAddress({
                    ...formData,
                    countryCode: 'TR',
                    isActive: true
                });
            }

            onSave();
        } catch (error: any) {
            console.error('Save address error:', error);
            toast.error(error.response?.data?.message || 'Failed to save address');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 flex-shrink-0">
                    <h2 className="text-lg font-bold text-zinc-800">
                        {address?.id ? 'Edit Delivery Address' : 'Add New Address'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-100 rounded transition-colors"
                    >
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Location Picker */}
                    <div className="w-full h-[300px] bg-zinc-100 rounded-lg overflow-hidden mb-4">
                        <LocationPicker
                            value={{ latitude: formData.latitude, longitude: formData.longitude }}
                            onChange={handleLocationChange}
                            onAddressSelect={handleAddressSelect}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">
                            Street / Neighborhood
                        </label>
                        <input
                            type="text"
                            name="street"
                            value={formData.street}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Building No
                            </label>
                            <input
                                type="text"
                                name="buildingNumber"
                                value={formData.buildingNumber}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Apartment No
                            </label>
                            <input
                                type="text"
                                name="apartmentNumber"
                                value={formData.apartmentNumber}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                District
                            </label>
                            <input
                                type="text"
                                name="district"
                                value={formData.district}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Province / City
                            </label>
                            <input
                                type="text"
                                name="province"
                                value={formData.province}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">
                            Postal Code
                        </label>
                        <input
                            type="text"
                            name="postalCode"
                            value={formData.postalCode}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isLoading ? 'Saving...' : 'Save Address'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
