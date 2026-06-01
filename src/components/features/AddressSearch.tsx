'use client';

import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, MapPin } from 'lucide-react';

interface AddressSearchProps {
    className?: string;
    onAddressSelect?: (lat: number, lng: number, address: string) => void;
    initialValue?: string;
}

export function AddressSearch({ className, onAddressSelect, initialValue }: AddressSearchProps) {
    const [inputValue, setInputValue] = useState(initialValue || '');
    const placesLib = useMapsLibrary('places');
    const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
    const requestIdRef = useRef(0);
    const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialValue) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setInputValue(initialValue);
        }
    }, [initialValue]);

    useEffect(() => {
        if (!placesLib) return;
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }, [placesLib]);

    useEffect(() => {
        // Click outside handler
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);

        if (!value.trim()) {
            setPredictions([]);
            setIsOpen(false);
            return;
        }

        if (!placesLib?.AutocompleteSuggestion) {
            setPredictions([]);
            setIsOpen(false);
            return;
        }

        if (!sessionTokenRef.current) {
            sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }

        const currentRequestId = ++requestIdRef.current;

        try {
            const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: value,
                includedRegionCodes: ['tr'],
                sessionToken: sessionTokenRef.current,
            });

            if (currentRequestId !== requestIdRef.current) return;

            const nextPredictions = suggestions
                .map((suggestion) => suggestion.placePrediction)
                .filter((prediction): prediction is google.maps.places.PlacePrediction => Boolean(prediction));

            setPredictions(nextPredictions);
            setIsOpen(nextPredictions.length > 0);
        } catch (error) {
            console.warn('Autocomplete suggestions failed', error);
            setPredictions([]);
            setIsOpen(false);
        }
    };

    const handleSelectPrediction = async (prediction: google.maps.places.PlacePrediction) => {
        try {
            const place = prediction.toPlace();
            await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });

            if (!place.location) return;

            const lat = place.location.lat();
            const lng = place.location.lng();
            const formattedAddress =
                place.formattedAddress ||
                prediction.text.toString();

            setInputValue(formattedAddress);
            setPredictions([]);
            setIsOpen(false);
            sessionTokenRef.current = placesLib ? new placesLib.AutocompleteSessionToken() : null;

            onAddressSelect?.(lat, lng, formattedAddress);
        } catch (error) {
            console.warn('Place details fetch failed', error);
        }
    };

    return (
        <div className={`relative w-full ${className || ''}`} ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                    placeholder="Search for a delivery address..."
                    className="w-full h-11 pl-10 pr-4 bg-white border border-zinc-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => inputValue && setIsOpen(true)}
                />
            </div>

            {isOpen && predictions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-zinc-100 py-2 z-[9999] max-h-[300px] overflow-y-auto">
                    {predictions.map((prediction) => (
                        <button
                            key={prediction.placeId}
                            className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-start gap-3 transition-colors border-b border-zinc-50 last:border-0"
                            onClick={() => handleSelectPrediction(prediction)}
                        >
                            <MapPin className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 truncate">
                                    {prediction.mainText?.toString() || prediction.text.toString()}
                                </p>
                                <p className="text-xs text-zinc-500 truncate mt-0.5">
                                    {prediction.secondaryText?.toString() || ''}
                                </p>
                            </div>
                        </button>
                    ))}

                    <div className="px-4 py-2 border-t border-zinc-100 mt-1 bg-zinc-50">
                        <div className="flex items-center justify-end gap-1">
                            <span className="text-[10px] text-zinc-400">Powered by</span>
                            <span className="text-[10px] font-bold text-zinc-500">Google</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
