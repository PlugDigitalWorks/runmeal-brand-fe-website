'use client';

import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, Search } from 'lucide-react';
import { KeyboardEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useBranch } from '@/context/BranchContext';

import type { AddressComponent, GeocodedAddress, Location } from './LocationPicker';

export interface AddressSearchResult {
    location: Location;
    address: GeocodedAddress;
}

interface Suggestion {
    id: string;
    label: string;
    placeId?: string;
    result?: AddressSearchResult;
}

interface AddressSearchProps {
    onSelect: (result: AddressSearchResult) => void;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;

export const toSearchResult = (result: google.maps.GeocoderResult): AddressSearchResult => ({
    location: { latitude: result.geometry.location.lat(), longitude: result.geometry.location.lng() },
    address: {
        formatted_address: result.formatted_address,
        address_components: result.address_components as AddressComponent[],
    },
});

const countryOf = (result: google.maps.GeocoderResult) =>
    result.address_components.find((component) => component.types.includes('country'))?.short_name.toUpperCase();

/**
 * Address search above the map, limited to the countries the brand's branches
 * are in — an address anywhere else could never be delivered to. Suggestions
 * come from Places Autocomplete; if the key has no Places API (New) access, the
 * geocoder answers instead. A pick is resolved through the geocoder either way,
 * so the form always receives the same address-component shape as a map click.
 */
export function AddressSearch({ onSelect }: AddressSearchProps) {
    const { t } = useTranslation();
    const { branches } = useBranch();
    // Empty until the branches load (or when none has a country): search worldwide.
    const countries = useMemo(
        () => [...new Set(branches.map((branch) => branch.countryCode?.toUpperCase()).filter(Boolean))] as string[],
        [branches],
    );
    const placesLib = useMapsLibrary('places');
    const geocodingLib = useMapsLibrary('geocoding');
    const geocoder = useMemo(() => (geocodingLib ? new geocodingLib.Geocoder() : null), [geocodingLib]);

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const timerRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);
    const placesUnavailableRef = useRef(false);
    const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

    const geocodeSuggestions = async (input: string): Promise<Suggestion[]> => {
        if (!geocoder) return [];
        try {
            // The geocoder restricts to one country only; with several, filter its answers instead.
            const { results } = await geocoder.geocode({
                address: input,
                ...(countries.length === 1 && { componentRestrictions: { country: countries[0] } }),
            });
            const inCountry = countries.length > 0
                ? results.filter((result) => countries.includes(countryOf(result) ?? ''))
                : results;
            return inCountry.slice(0, MAX_SUGGESTIONS).map((result) => ({
                id: result.place_id,
                label: result.formatted_address,
                result: toSearchResult(result),
            }));
        } catch {
            // ZERO_RESULTS rejects too; an empty list is the answer either way.
            return [];
        }
    };

    const fetchSuggestions = async (input: string): Promise<Suggestion[]> => {
        if (placesLib && !placesUnavailableRef.current) {
            try {
                sessionTokenRef.current ??= new placesLib.AutocompleteSessionToken();
                const { suggestions: predictions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input,
                    sessionToken: sessionTokenRef.current,
                    // Places accepts at most 15 region codes.
                    ...(countries.length > 0 && { includedRegionCodes: countries.slice(0, 15) }),
                });
                return predictions.slice(0, MAX_SUGGESTIONS).flatMap((suggestion) => {
                    const prediction = suggestion.placePrediction;
                    return prediction
                        ? [{ id: prediction.placeId, label: prediction.text.toString(), placeId: prediction.placeId }]
                        : [];
                });
            } catch (error) {
                // Places API (New) is not enabled for this key; stop asking it.
                console.warn('[AddressSearch] Places autocomplete unavailable, using the geocoder', error);
                placesUnavailableRef.current = true;
            }
        }
        return geocodeSuggestions(input);
    };

    const search = (input: string) => {
        const requestId = ++requestIdRef.current;
        setIsSearching(true);
        void fetchSuggestions(input).then((found) => {
            if (requestId !== requestIdRef.current) return;
            setSuggestions(found);
            setActiveIndex(found.length > 0 ? 0 : -1);
            setHasSearched(true);
            setIsSearching(false);
            setIsOpen(true);
        });
    };

    const handleChange = (value: string) => {
        setQuery(value);
        if (timerRef.current) window.clearTimeout(timerRef.current);

        if (value.trim().length < MIN_QUERY_LENGTH) {
            requestIdRef.current += 1;
            setSuggestions([]);
            setHasSearched(false);
            setIsSearching(false);
            setIsOpen(false);
            return;
        }

        timerRef.current = window.setTimeout(() => search(value.trim()), DEBOUNCE_MS);
    };

    const choose = async (suggestion: Suggestion) => {
        setQuery(suggestion.label);
        setIsOpen(false);
        sessionTokenRef.current = null;

        let result = suggestion.result;
        if (!result && suggestion.placeId && geocoder) {
            try {
                const { results } = await geocoder.geocode({ placeId: suggestion.placeId });
                if (results[0]) result = toSearchResult(results[0]);
            } catch (error) {
                console.error('[AddressSearch] Could not resolve the chosen place', error);
            }
        }
        if (result) onSelect(result);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (suggestions.length === 0) return;
            event.preventDefault();
            setIsOpen(true);
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length);
            return;
        }
        if (event.key === 'Escape') {
            setIsOpen(false);
            return;
        }
        if (event.key !== 'Enter') return;

        // Enter must never submit the surrounding address form.
        event.preventDefault();
        const picked = suggestions[activeIndex] ?? suggestions[0];
        if (isOpen && picked) {
            void choose(picked);
            return;
        }
        // Free-text search: geocode whatever was typed and take the best match.
        const input = query.trim();
        if (!input) return;
        setIsSearching(true);
        void geocodeSuggestions(input).then((found) => {
            setIsSearching(false);
            if (found[0]) {
                void choose(found[0]);
            } else {
                setSuggestions([]);
                setHasSearched(true);
                setIsOpen(true);
            }
        });
    };

    return (
        <div className="relative">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                    type="text"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls="address-search-results"
                    aria-autocomplete="list"
                    aria-label={t('address.searchPlaceholder')}
                    value={query}
                    onChange={(event) => handleChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setIsOpen(true)}
                    onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
                    placeholder={t('address.searchPlaceholder')}
                    autoComplete="off"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-9 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
                )}
            </div>

            {isOpen && hasSearched && (
                <ul
                    id="address-search-results"
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
                >
                    {suggestions.length === 0 ? (
                        <li className="px-3 py-2 text-zinc-500">{t('address.searchNoResults')}</li>
                    ) : (
                        suggestions.map((suggestion, index) => (
                            <li
                                key={suggestion.id}
                                role="option"
                                aria-selected={index === activeIndex}
                                // mousedown fires before the input's blur closes the list.
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    void choose(suggestion);
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`cursor-pointer px-3 py-2 text-zinc-700 ${index === activeIndex ? 'bg-zinc-100' : ''}`}
                            >
                                {suggestion.label}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
