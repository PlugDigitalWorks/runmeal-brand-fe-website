'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ApiResponse } from '@/types/auth';
import { userService } from '@/services/user.service';
import { AxiosError } from 'axios';
import { Save, Loader2 } from 'lucide-react'; // Added Loader2 for loading state
import { LocationPicker, GeocodedAddress, Location } from './LocationPicker';
import { AddressSelects } from './AddressSelects';
import { Country, State, City } from 'country-state-city';
import { useCallback, useRef, useEffect, useState } from 'react';
import { extractStreetAndBuilding, getAddressComponent, normalizeLocationName } from '@/lib/address-parsing';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// Helper to normalize strings for comparison
const normalizeName = (name: string) => {
    return normalizeLocationName(name)
};

// Schema for Address
const createAddressSchema = (t: TFunction) => z.object({
    countryCode: z.string().min(1, t('address.validation.countryRequired')),
    district: z.string().min(1, t('address.validation.districtRequired')),
    province: z.string().min(1, t('address.validation.provinceRequired')),
    phoneE164: z.string()
        .trim()
        .min(1, t('address.validation.phoneRequired'))
        .refine((value) => /^\+[1-9]\d{7,14}$/.test(value), t('address.validation.phoneFormat')),
    postalCode: z.string().min(1, t('address.validation.postalCodeRequired')),
    street: z.string().min(1, t('address.validation.streetRequired')),
    buildingNumber: z.string().min(1, t('address.validation.buildingRequired')),
    apartmentNumber: z.string().trim().min(1, t('address.validation.apartmentRequired')),
    latitude: z.any().transform(val => Number(val)),
    longitude: z.any().transform(val => Number(val)),
});

export type AddressFormValues = z.infer<ReturnType<typeof createAddressSchema>>;

interface AddressFormProps {
    initialValues?: Partial<AddressFormValues>;
    addressId?: string | null;
    onCancel: () => void;
    onSuccess: () => Promise<void>;
}

const Input = ({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string, error?: string }) => (
    <div className="space-y-2">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
        </label>
        <input
            className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500 focus-visible:ring-red-500' : 'border-zinc-200 focus-visible:ring-zinc-950'}`}
            {...props}
        />
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
);

const Button = ({ children, isLoading, variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean, variant?: 'primary' | 'outline' }) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2";
    const variants = {
        primary: "bg-primary text-white hover:bg-primary/90",
        outline: "border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
};

export function AddressForm({ initialValues, addressId, onCancel, onSuccess }: AddressFormProps) {
    const { t } = useTranslation();
    const [addressLoading, setAddressLoading] = useState(false);
    const [searchAddress, setSearchAddress] = useState<string | undefined>(undefined);
    const ignoreSearchRef = useRef(false);

    const defaultValues = {
        countryCode: 'TR',
        district: 'Fatih',
        province: 'İstanbul',
        phoneE164: '',
        postalCode: '',
        street: '',
        buildingNumber: '',
        apartmentNumber: '',
        latitude: undefined,
        longitude: undefined,
        ...initialValues
    };

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        control,
        formState: { errors },
    } = useForm<AddressFormValues>({
        resolver: zodResolver(createAddressSchema(t)),
        defaultValues: defaultValues as import('react-hook-form').DefaultValues<AddressFormValues>
    });

    const watchedFields = watch(['countryCode', 'district', 'street']);

    useEffect(() => {
        if (ignoreSearchRef.current) {
            ignoreSearchRef.current = false;
            return;
        }

        const timer = setTimeout(() => {
            const [countryCode, district, street] = watchedFields;
            if (countryCode || district || street) {

                const parts = [street, district, countryCode].filter(Boolean);
                if (parts.length > 0) {
                    setSearchAddress(parts.join(', '));
                }
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [watchedFields]);

    const handleAddressSelect = useCallback((address: GeocodedAddress) => {
        ignoreSearchRef.current = true;

        const components = address.address_components;
        const getComponent = (type: string) => getAddressComponent(components, type);

        const countryRaw = getComponent('country');
        const administrativeAreaLevel1 = getComponent('administrative_area_level_1');
        const administrativeAreaLevel2 = getComponent('administrative_area_level_2');
        const locality = getComponent('locality');
        const sublocality = getComponent('sublocality');
        const postalCode = getComponent('postal_code');
        const { street, building } = extractStreetAndBuilding(address);

        // 1. Match Country
        const allCountries = Country.getAllCountries();
        let matchedCountry = allCountries.find(c =>
            normalizeName(c.name) === normalizeName(countryRaw) ||
            c.isoCode === countryRaw ||
            normalizeName(c.name).includes(normalizeName(countryRaw))
        );

        // Explicit fix for Türkiye -> Turkey if not found above
        if (!matchedCountry && (countryRaw.toLowerCase() === 'türkiye' || countryRaw.toLowerCase() === 'turkiye')) {
            matchedCountry = allCountries.find(c => c.isoCode === 'TR');
        }

        const countryCode = matchedCountry?.isoCode || 'TR';

        // 2. Match State (Province)
        let finalState = '';
        let stateCode = '';

        if (matchedCountry) {
            const countryStates = State.getStatesOfCountry(countryCode);
            const matchedState = countryStates.find(s =>
                normalizeName(s.name) === normalizeName(administrativeAreaLevel1) ||
                s.isoCode === administrativeAreaLevel1 ||
                normalizeName(s.name).includes(normalizeName(administrativeAreaLevel1))
            );

            if (matchedState) {
                finalState = matchedState.name;
                stateCode = matchedState.isoCode;
            }
        }

        // 3. Match City (District)
        let finalCity = '';
        const possibleCities = [locality, administrativeAreaLevel2, sublocality].filter(Boolean);

        if (countryCode && stateCode) {
            const stateCities = City.getCitiesOfState(countryCode, stateCode);
            const matchedCity = stateCities.find(c => possibleCities.some(pc => normalizeName(c.name) === normalizeName(pc)));
            if (matchedCity) {
                finalCity = matchedCity.name;
            }
        }

        // Fallback
        if (!finalCity && possibleCities.length > 0) finalCity = possibleCities[0];
        if (!finalState && administrativeAreaLevel1) finalState = administrativeAreaLevel1;

        setValue('countryCode', countryCode);
        setValue('province', finalState);
        setValue('district', finalCity);

        setValue('postalCode', postalCode || '');
        setValue('street', street || '');
        if (building) setValue('buildingNumber', building);

        setSearchAddress(undefined);
    }, [setValue]);

    const onSubmit = async (data: AddressFormValues) => {
        setAddressLoading(true);
        try {
            if (addressId) {
                // Update existing
                await userService.updateAddress(addressId, data);
                await onSuccess();
            } else {
                // Create new
                await userService.createAddress({ ...data, isActive: true });
                await onSuccess();
            }
        } catch (err) {
            const error = err as AxiosError<ApiResponse<unknown>>;
            console.error('Failed to save address', error);
            if (error.response?.status === 429) {
                alert(t('address.rateLimited'));
            } else {
                alert(t('address.saveFailed'));
            }
        } finally {
            setAddressLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <LocationPicker
                    value={
                        watch('latitude') && watch('longitude')
                            ? { latitude: Number(watch('latitude')), longitude: Number(watch('longitude')) }
                            : undefined
                    }
                    onChange={(loc: Location) => {
                        setValue('latitude', loc.latitude);
                        setValue('longitude', loc.longitude);
                    }}
                    onAddressSelect={handleAddressSelect}
                    searchQuery={searchAddress}
                />
            </div>

            <AddressSelects
                control={control}
                setValue={setValue}
                currentCountry={watch('countryCode')}
                currentState={watch('province')}
                errors={errors}
                className="col-span-full"
                onLocationChange={(lat, lng) => {
                    setValue('latitude', lat);
                    setValue('longitude', lng);
                }}
            />
            {/* Hidden inputs to register fields if needed, or rely on Controller */}
            <div className="hidden">
                <Input label={t('address.country')} {...register('countryCode')} />
                <Input label={t('address.district')} {...register('district')} />
                <Input label={t('address.province')} {...register('province')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    label={t('address.phone')}
                    type="tel"
                    placeholder="+905551112233"
                    {...register('phoneE164')}
                    error={errors.phoneE164?.message}
                />
                <Input label={t('address.postalCode')} placeholder="34000" {...register('postalCode')} error={errors.postalCode?.message} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('address.street')} {...register('street')} error={errors.street?.message} />
                <Input label={t('address.buildingNo')} {...register('buildingNumber')} error={errors.buildingNumber?.message} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('address.apartmentNo')} placeholder={t('address.apartmentNo')} {...register('apartmentNumber')} error={errors.apartmentNumber?.message} />
            </div>

            <div className="flex justify-end pt-2 gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" isLoading={addressLoading}>
                    <Save className="h-4 w-4 mr-2" /> {addressId ? t('address.updateAddress') : t('address.saveAddress')}
                </Button>
            </div>
        </form>
    );
}
