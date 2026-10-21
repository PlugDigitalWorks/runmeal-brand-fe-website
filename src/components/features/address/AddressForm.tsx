'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ApiResponse } from '@/types/auth';
import type { Address } from '@/types/address';
import { userService } from '@/services/user.service';
import { AxiosError } from 'axios';
import { Save, Loader2, MapPin } from 'lucide-react'; // Added Loader2 for loading state
import { LocationPicker, AddressComponent, GeocodedAddress, Location } from './LocationPicker';
import { AddressSearch, AddressSearchResult, toSearchResult } from './AddressSearch';
import { PhoneField } from './PhoneField';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { composeFirstLine, extractStreetAndBuilding, formatAddressFirstLine, getAddressComponent, normalizeLocationName } from '@/lib/address-parsing';
import { AddressRegion, resolveAddressRegion, resolveRegionFromGoogle } from '@/lib/address-region';
import { DEFAULT_ADDRESS_LOCATION, fetchVisitorLocation } from '@/lib/visitor-location';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

/** Postal-code examples per country; anything else shows no placeholder. */
const POSTAL_CODE_PLACEHOLDERS: Record<string, string> = { GB: 'TW9 1AN', TR: '34000', US: '10001' };
/** Address line examples per country; anything else shows no placeholder. */
const FIRST_LINE_PLACEHOLDERS: Record<string, string> = { GB: '10 Hill Street', TR: 'Moda Cd. No: 5', US: '350 5th Ave' };
const SECOND_LINE_PLACEHOLDERS: Record<string, string> = { GB: 'Flat 2', TR: 'D: 3', US: 'Apt 4B' };
/** The API's `street` holds both lines joined with ", ". */
const STREET_MAX_LENGTH = 256;
const SECOND_LINE_MAX_LENGTH = 120;
const joinAddressLines = (line1: string, line2: string) => [line1.trim(), line2.trim()].filter(Boolean).join(', ');

const POSTAL_LOOKUP_DEBOUNCE_MS = 800;
/** The API's limit for the courier note. */
const NOTE_MAX_LENGTH = 500;
/** The address search above the map is off for now: postcode and address lines place the pin. */
const SHOW_ADDRESS_SEARCH = false;

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
    // Address line 1; it also drives the map. Line 2 is optional and both are
    // sent joined as the API's single `street`.
    street: z.string().trim()
        .min(2, t('address.validation.firstLineRequired'))
        .max(STREET_MAX_LENGTH, t('address.validation.lineMax', { max: STREET_MAX_LENGTH })),
    line2: z.string().trim().max(SECOND_LINE_MAX_LENGTH, t('address.validation.lineMax', { max: SECOND_LINE_MAX_LENGTH })),
    note: z.string().trim().max(NOTE_MAX_LENGTH, t('address.validation.noteMax', { max: NOTE_MAX_LENGTH })),
    latitude: z.any().transform(val => Number(val)),
    longitude: z.any().transform(val => Number(val)),
}).superRefine((values, ctx) => {
    // A saved address can already fill line 1 close to the limit.
    if (joinAddressLines(values.street, values.line2).length > STREET_MAX_LENGTH) {
        ctx.addIssue({ code: 'custom', path: ['line2'], message: t('address.validation.linesTooLong', { max: STREET_MAX_LENGTH }) });
    }
});

export type AddressFormValues = z.infer<ReturnType<typeof createAddressSchema>>;

interface AddressFormProps {
    /** The saved address being edited; omitted for a new one. */
    address?: Address;
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

export function AddressForm({ address, onCancel, onSuccess }: AddressFormProps) {
    const { t } = useTranslation();
    const [addressLoading, setAddressLoading] = useState(false);
    const [searchAddress, setSearchAddress] = useState<string | undefined>(undefined);
    const [postalLookup, setPostalLookup] = useState<'idle' | 'loading' | 'notFound'>('idle');
    const addressId = address?.id;
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
        line2: '',
        note: '',
        latitude: isNewAddress ? DEFAULT_ADDRESS_LOCATION.latitude : undefined,
        longitude: isNewAddress ? DEFAULT_ADDRESS_LOCATION.longitude : undefined,
        ...(address && {
            countryCode: address.countryCode,
            district: address.district,
            province: address.province,
            phoneE164: address.phoneE164 ?? '',
            postalCode: address.postalCode,
            // A saved address keeps one joined line; it comes back whole in line 1.
            street: formatAddressFirstLine(address),
            note: address.note ?? '',
            latitude: address.latitude,
            longitude: address.longitude,
        }),
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
    const watchedProvince = watch('province');
    const regionLabel = [watchedDistrict, watchedProvince].filter(Boolean).join(', ');
    const regionError = errors.countryCode || errors.province || errors.district
        ? t('address.validation.locationRequired')
        : undefined;

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
    const applyFields = useCallback((fields: Partial<AddressRegion> & { street?: string; postalCode?: string; location?: Location }) => {
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
            street: composeFirstLine(street, building, region.countryCode),
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
            // A postcode is an area, not a house. The addresses nearest to its
            // centre give the street (when the postcode result lacks one) and a
            // house number to start from.
            const nearby = await geocode({ location: { lat: location.latitude, lng: location.longitude } });
            if (cancelled) return;
            const nearbyAddresses = nearby.filter((result) =>
                result.types.some((type) => ['street_address', 'premise', 'subpremise', 'route'].includes(type)),
            );

            let street = getAddressComponent(address.address_components, 'route');
            if (!street && nearbyAddresses[0]) {
                street = extractStreetAndBuilding(toSearchResult(nearbyAddresses[0]).address).street;
            }

            // Nearest numbered address on that street, inside the same postcode
            // when Google has one there. It is a best guess the customer can
            // correct; the pin moves onto it so number and pin agree.
            const numberedOnStreet = nearbyAddresses.filter((result) => {
                const components = result.address_components as AddressComponent[];
                return Boolean(getAddressComponent(components, 'street_number')) &&
                    (!street || normalizeLocationName(getAddressComponent(components, 'route')) === normalizeLocationName(street));
            });
            const nearestNumbered =
                numberedOnStreet.find((result) =>
                    comparablePostalCode(getAddressComponent(result.address_components as AddressComponent[], 'postal_code')) ===
                    comparablePostalCode(postalCode),
                ) ?? numberedOnStreet[0];
            const nearestNumber = nearestNumbered
                ? getAddressComponent(nearestNumbered.address_components as AddressComponent[], 'street_number')
                : '';

            // A first line the customer already wrote on this street is theirs
            // and stays; otherwise it is replaced with the street and number.
            const currentLine = getValues('street') ?? '';
            const keepsLine = Boolean(currentLine.trim()) &&
                (!street || normalizeLocationName(currentLine).includes(normalizeLocationName(street)));
            const region = resolveRegionFromGoogle(address.address_components, country);
            const fillsLine = Boolean(street) && !keepsLine;

            const googlePostalCode = getAddressComponent(address.address_components, 'postal_code');
            userEditedRef.current = true;
            applyFields({
                ...region,
                location: fillsLine && nearestNumbered ? toSearchResult(nearestNumbered).location : location,
                // Keep what the customer typed unless Google returns the same code formatted properly.
                postalCode: googlePostalCode && comparablePostalCode(googlePostalCode) === comparablePostalCode(postalCode)
                    ? googlePostalCode
                    : postalCode,
                ...(fillsLine ? { street: composeFirstLine(street, nearestNumber, region.countryCode) } : {}),
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
        // Line 1 and 2 go joined as the API's `street`; null clears the building
        // number an older row kept apart; `note` always goes along ("" clears it).
        const { line2, ...fields } = data;
        const payload = { ...fields, street: joinAddressLines(fields.street, line2), buildingNumber: null };
        try {
            if (addressId) {
                await userService.updateAddress(addressId, payload);
            } else {
                await userService.createAddress({ ...payload, isActive: true });
            }
            await onSuccess();
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
                {SHOW_ADDRESS_SEARCH && <AddressSearch onSelect={handleSearchSelect} />}
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

            {/* Country, province and district come from the search, the map pin,
                the postcode or the visitor location; the customer types the rest. */}
            {regionLabel && (
                <p className="flex items-center gap-1.5 text-sm text-zinc-600">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    {regionLabel}
                </p>
            )}
            {regionError && <p className="text-xs font-medium text-red-500">{regionError}</p>}
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
            <Input
                label={t('address.firstLine')}
                placeholder={FIRST_LINE_PLACEHOLDERS[watchedCountry] ?? ''}
                autoComplete="address-line1"
                maxLength={STREET_MAX_LENGTH}
                {...register('street')}
                error={errors.street?.message}
            />
            <Input
                label={`${t('address.secondLine')} (${t('address.optional')})`}
                placeholder={SECOND_LINE_PLACEHOLDERS[watchedCountry] ?? ''}
                autoComplete="address-line2"
                maxLength={SECOND_LINE_MAX_LENGTH}
                {...register('line2')}
                error={errors.line2?.message}
            />
            <div className="space-y-2">
                <label htmlFor="address-note" className="text-sm font-medium leading-none">
                    {t('address.note')} <span className="font-normal text-zinc-400">({t('address.optional')})</span>
                </label>
                <textarea
                    id="address-note"
                    rows={3}
                    maxLength={NOTE_MAX_LENGTH}
                    placeholder={t('address.notePlaceholder')}
                    {...register('note')}
                    className={`flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 ${errors.note ? 'border-red-500 focus-visible:ring-red-500' : 'border-zinc-200 focus-visible:ring-zinc-950'}`}
                />
                {errors.note && <p className="text-xs font-medium text-red-500">{errors.note.message}</p>}
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
