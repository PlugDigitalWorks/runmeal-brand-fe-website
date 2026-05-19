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
    const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
    const placesService = useRef<google.maps.places.PlacesService | null>(null);
    const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const placesServiceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialValue) {
            setInputValue(initialValue);
        }
    }, [initialValue]);

    useEffect(() => {
        if (!placesLib) return;
        autocompleteService.current = new placesLib.AutocompleteService();
        // We need a dummy element for PlacesService if we want to use getDetails
        if (placesServiceRef.current) {
            placesService.current = new placesLib.PlacesService(placesServiceRef.current);
        }
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);

        if (!value.trim()) {
            setPredictions([]);
            setIsOpen(false);
            return;
        }

        if (autocompleteService.current) {
            autocompleteService.current.getPlacePredictions({
                input: value,
                componentRestrictions: { country: 'tr' }, // Restrict to Turkey
                types: ['geocode', 'establishment']
            }, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    setPredictions(results);
                    setIsOpen(true);
                } else {
                    setPredictions([]);
                }
            });
        }
    };

    const handleSelectPrediction = async (placeId: string, description: string) => {
        if (!placesLib) return;

        let processed = false;

        // Try New Places API first if available
        if (placesLib.Place) {
            try {
                const place = new placesLib.Place({ id: placeId });
                // @ts-ignore
                await place.fetchFields({ fields: ['location', 'formattedAddress'] });

                const location = place.location;
                const formattedAddress = place.formattedAddress;

                if (location) {
                    const lat = location.lat();
                    const lng = location.lng();
                    setInputValue(description);
                    setIsOpen(false);
                    if (onAddressSelect) {
                        onAddressSelect(lat, lng, formattedAddress || description);
                    }
                    processed = true;
                }
            } catch (error) {
                console.warn("New Places API failed, falling back to legacy...", error);
            }
        }

        // Fallback to Legacy PlacesService if new API missing or failed
        if (!processed) {
            if (!placesService.current && placesServiceRef.current) {
                placesService.current = new placesLib.PlacesService(placesServiceRef.current);
            }

            if (placesService.current) {
                placesService.current.getDetails({
                    placeId: placeId,
                    fields: ['geometry', 'formatted_address']
                }, (place, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                        const lat = place.geometry.location.lat();
                        const lng = place.geometry.location.lng();

                        setInputValue(description);
                        setIsOpen(false);

                        if (onAddressSelect) {
                            onAddressSelect(lat, lng, description);
                        }
                    }
                });
            }
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
                            key={prediction.place_id}
                            className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-start gap-3 transition-colors border-b border-zinc-50 last:border-0"
                            onClick={() => handleSelectPrediction(prediction.place_id, prediction.description)}
                        >
                            <MapPin className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 truncate">
                                    {prediction.structured_formatting.main_text}
                                </p>
                                <p className="text-xs text-zinc-500 truncate mt-0.5">
                                    {prediction.structured_formatting.secondary_text}
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

            {/* Hidden div for Places Service */}
            <div ref={placesServiceRef} />
        </div>
    );
}
