'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ApiResponse } from '@/types/auth';
import { userService } from '@/services/user.service';
import { AxiosError } from 'axios';
import { Save, Loader2 } from 'lucide-react'; // Added Loader2 for loading state
import { LocationPicker, GeocodedAddress, Location } from './LocationPicker';
import { AddressSearch, AddressSearchResult, toSearchResult } from './AddressSearch';
import { PhoneField } from './PhoneField';
import { AddressSelects } from './AddressSelects';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { extractStreetAndBuilding, getAddressComponent } from '@/lib/address-parsing';
import { AddressRegion, resolveAddressRegion, resolveRegionFromGoogle } from '@/lib/address-region';
import { DEFAULT_ADDRESS_LOCATION, fetchVisitorLocation } from '@/lib/visitor-location';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

/** Postal-code examples per country; anything else shows no placeholder. */
const POSTAL_CODE_PLACEHOLDERS: Record<string, string> = { GB: 'TW9 1AN', TR: '34000', US: '10001' };

const POSTAL_LOOKUP_DEBOUNCE_MS = 800;

const searchKey = (countryCode?: string, district?: string, street?: string) =>
    [street, district, countryCode].filter(Boolean).join(', ');

const comparablePostalCode = (value: string) => value.replace(/\s+/g, '').toUpperCase();

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
    const [postalLookup, setPostalLookup] = useState<'idle' | 'loading' | 'notFound'>('idle');
    const isNewAddress = !addressId;

    // A new address starts in Richmond, London until the visitor's own
    // location (if Cloudflare knows it) replaces it below.
    const defaultValues = {
        countryCode: DEFAULT_ADDRESS_LOCATION.countryCode,
        district: DEFAULT_ADDRESS_LOCATION.district,
        province: DEFAULT_ADDRESS_LOCATION.province,
        phoneE164: '',
        postalCode: '',
        street: '',
        buildingNumber: '',
        apartmentNumber: '',
        latitude: isNewAddress ? DEFAULT_ADDRESS_LOCATION.latitude : undefined,
        longitude: isNewAddress ? DEFAULT_ADDRESS_LOCATION.longitude : undefined,
        ...initialValues
    };

    const geocodingLib = useMapsLibrary('geocoding');
    const geocoder = useMemo(() => (geocodingLib ? new geocodingLib.Geocoder() : null), [geocodingLib]);

    // What the form -> map sync last saw. Values we fill in ourselves (from the
    // map, search, postcode or visitor location) are recorded here first so
    // they do not bounce back into another geocode.
    const lastSyncedRef = useRef(searchKey(defaultValues.countryCode, defaultValues.district, defaultValues.street));
    const lastPostalLookupRef = useRef(comparablePostalCode(defaultValues.postalCode ?? ''));
    // Once the customer has touched the form, the visitor location must not
    // overwrite their choice when it arrives late.
    const userEditedRef = useRef(false);

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        watch,
        control,
        formState: { errors },
    } = useForm<AddressFormValues>({
        resolver: zodResolver(createAddressSchema(t)),
        defaultValues: defaultValues as import('react-hook-form').DefaultValues<AddressFormValues>
    });

    const [watchedCountry, watchedDistrict, watchedStreet, watchedPostalCode] = watch(['countryCode', 'district', 'street', 'postalCode']);

    useEffect(() => {
        const key = searchKey(watchedCountry, watchedDistrict, watchedStreet);
        if (!key || key === lastSyncedRef.current) return;

        const timer = setTimeout(() => {
            lastSyncedRef.current = key;
            setSearchAddress(key);
        }, 1000);

        return () => clearTimeout(timer);
    }, [watchedCountry, watchedDistrict, watchedStreet]);

    /** Fills fields without the form -> map sync or postcode lookup reacting to it. */
    const applyFields = useCallback((fields: Partial<AddressRegion> & { street?: string; buildingNumber?: string; postalCode?: string; location?: Location }) => {
        const next = {
            countryCode: fields.countryCode ?? getValues('countryCode'),
            district: fields.district ?? getValues('district'),
            street: fields.street ?? getValues('street'),
        };
        lastSyncedRef.current = searchKey(next.countryCode, next.district, next.street);
        if (fields.postalCode !== undefined) lastPostalLookupRef.current = comparablePostalCode(fields.postalCode);

        if (fields.countryCode !== undefined) setValue('countryCode', fields.countryCode);
        if (fields.province !== undefined) setValue('province', fields.province);
        if (fields.district !== undefined) setValue('district', fields.district);
        if (fields.postalCode !== undefined) setValue('postalCode', fields.postalCode);
        if (fields.street !== undefined) setValue('street', fields.street);
        if (fields.buildingNumber !== undefined) setValue('buildingNumber', fields.buildingNumber);
        if (fields.location) {
            setValue('latitude', fields.location.latitude);
            setValue('longitude', fields.location.longitude);
        }
        setSearchAddress(undefined);
    }, [getValues, setValue]);

    const handleAddressSelect = useCallback((address: GeocodedAddress) => {
        userEditedRef.current = true;
        const region = resolveRegionFromGoogle(address.address_components, getValues('countryCode'));
        const { street, building } = extractStreetAndBuilding(address);

        applyFields({
            ...region,
            postalCode: getAddressComponent(address.address_components, 'postal_code'),
            street: street || '',
            ...(building ? { buildingNumber: building } : {}),
        });
    }, [applyFields, getValues]);

    const handleSearchSelect = useCallback((result: AddressSearchResult) => {
        applyFields({ location: result.location });
        handleAddressSelect(result.address);
    }, [applyFields, handleAddressSelect]);

    // New address: start from where Cloudflare places the visitor, if known.
    useEffect(() => {
        if (!isNewAddress) return;
        let cancelled = false;

        void fetchVisitorLocation().then((visitor) => {
            if (cancelled || userEditedRef.current || !visitor?.countryCode) return;

            const region = resolveAddressRegion(
                {
                    countries: [visitor.countryCode],
                    regions: [visitor.region ?? '', visitor.regionCode ?? ''],
                    cities: [visitor.city ?? ''],
                },
                visitor.countryCode,
            );
            const hasCoordinates = visitor.latitude !== null && visitor.longitude !== null;
            applyFields({
                ...region,
                ...(hasCoordinates ? { location: { latitude: visitor.latitude!, longitude: visitor.longitude! } } : {}),
            });
            // Without coordinates, let the map follow the visitor's region.
            if (!hasCoordinates) setSearchAddress(searchKey(region.countryCode, region.district));
        });

        return () => {
            cancelled = true;
        };
    }, [isNewAddress, applyFields]);

    // Postcode first, like UK addresses: a recognised postcode fills the rest.
    useEffect(() => {
        const postalCode = (watchedPostalCode ?? '').trim();
        if (!geocoder || postalCode.length < 3 || comparablePostalCode(postalCode) === lastPostalLookupRef.current) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            lastPostalLookupRef.current = comparablePostalCode(postalCode);
            setPostalLookup('loading');

            const country = getValues('countryCode');
            const geocode = async (request: google.maps.GeocoderRequest) => {
                try {
                    return (await geocoder.geocode(request)).results;
                } catch {
                    return [];
                }
            };

            let results = country ? await geocode({ componentRestrictions: { postalCode, country } }) : [];
            if (results.length === 0) results = await geocode({ address: postalCode });
            const match = results[0];
            if (cancelled) return;
            if (!match) {
                setPostalLookup('notFound');
                return;
            }

            const { location, address } = toSearchResult(match);
            // A postcode resolves to an area; the nearest street address names the street.
            const nearby = await geocode({ location: { lat: location.latitude, lng: location.longitude } });
            if (cancelled) return;
            const streetResult = nearby.find((result) => result.types.some((type) => ['street_address', 'premise', 'route'].includes(type)));
            const street = streetResult ? extractStreetAndBuilding(toSearchResult(streetResult).address).street : '';

            const googlePostalCode = getAddressComponent(address.address_components, 'postal_code');
            userEditedRef.current = true;
            applyFields({
                ...resolveRegionFromGoogle(address.address_components, country),
                location,
                // Keep what the customer typed unless Google returns the same code formatted properly.
                postalCode: googlePostalCode && comparablePostalCode(googlePostalCode) === comparablePostalCode(postalCode)
                    ? googlePostalCode
                    : postalCode,
                ...(street && !getValues('street') ? { street } : {}),
            });
            setPostalLookup('idle');
        }, POSTAL_LOOKUP_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [watchedPostalCode, geocoder, getValues, applyFields]);

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
        <form
            onSubmit={handleSubmit(onSubmit)}
            onInputCapture={() => { userEditedRef.current = true; }}
            className="space-y-4"
        >
            <div className="space-y-2">
                <AddressSearch onSelect={handleSearchSelect} />
                <LocationPicker
                    value={
                        watch('latitude') && watch('longitude')
                            ? { latitude: Number(watch('latitude')), longitude: Number(watch('longitude')) }
                            : undefined
                    }
                    onChange={(loc: Location) => {
                        userEditedRef.current = true;
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
                <Controller
                    name="phoneE164"
                    control={control}
                    render={({ field }) => (
                        <PhoneField
                            label={t('address.phone')}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            countryCode={watch('countryCode')}
                            error={errors.phoneE164?.message}
                        />
                    )}
                />
                <div className="space-y-1">
                    <Input
                        label={t('address.postalCode')}
                        placeholder={POSTAL_CODE_PLACEHOLDERS[watchedCountry] ?? ''}
                        autoComplete="postal-code"
                        {...register('postalCode')}
                        error={errors.postalCode?.message}
                    />
                    {postalLookup === 'loading' && <p className="text-xs text-zinc-500">{t('address.postalCodeLooking')}</p>}
                    {postalLookup === 'notFound' && <p className="text-xs text-amber-600">{t('address.postalCodeNotFound')}</p>}
                </div>
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
