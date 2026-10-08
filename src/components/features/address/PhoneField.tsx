'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Country } from 'country-state-city';

interface DialOption {
    isoCode: string;
    name: string;
    flag: string;
    dial: string; // digits only, e.g. "44", "1684"
}

// country-state-city stores codes like "44" or "+1-684"; E.164 needs digits only.
const DIAL_OPTIONS: DialOption[] = Country.getAllCountries()
    .map((c) => ({ isoCode: c.isoCode, name: c.name, flag: c.flag, dial: c.phonecode.replace(/\D/g, '') }))
    .filter((c) => c.dial)
    .sort((a, b) => a.name.localeCompare(b.name));

const FALLBACK_COUNTRY = 'TR';

// Codes shared by several countries (e.g. +44 for GB, GG, IM, JE) resolve to the main one.
const MAIN_COUNTRY_BY_DIAL: Record<string, string> = { '1': 'US', '7': 'RU', '44': 'GB', '47': 'NO', '61': 'AU', '39': 'IT', '358': 'FI' };

const dialOf = (isoCode: string) => DIAL_OPTIONS.find((o) => o.isoCode === isoCode)?.dial ?? '';

/** Splits "+447700900123" into its country and national part, preferring `preferredIso` when its code matches. */
function splitE164(value: string, preferredIso: string): { isoCode: string; national: string } | null {
    if (!value.startsWith('+')) return null;
    const digits = value.slice(1);
    const preferredDial = dialOf(preferredIso);
    if (preferredDial && digits.startsWith(preferredDial)) {
        return { isoCode: preferredIso, national: digits.slice(preferredDial.length) };
    }
    const match = DIAL_OPTIONS
        .filter((o) => digits.startsWith(o.dial))
        .sort((a, b) =>
            b.dial.length - a.dial.length ||
            Number(MAIN_COUNTRY_BY_DIAL[b.dial] === b.isoCode) - Number(MAIN_COUNTRY_BY_DIAL[a.dial] === a.isoCode))[0];
    return match ? { isoCode: match.isoCode, national: digits.slice(match.dial.length) } : null;
}

/** National number typed with or without the trunk 0 ("0533…" / "533…") becomes "+90533…". */
function toE164(isoCode: string, national: string): string {
    const digits = national.replace(/\D/g, '').replace(/^0+/, '');
    return digits ? `+${dialOf(isoCode)}${digits}` : '';
}

interface PhoneFieldProps {
    label: string;
    value?: string;
    onChange: (e164: string) => void;
    onBlur?: () => void;
    /** Country picked in the address form; the dial code follows it until the user picks one by hand. */
    countryCode?: string;
    error?: string;
}

export function PhoneField({ label, value = '', onChange, onBlur, countryCode, error }: PhoneFieldProps) {
    const initial = useMemo(
        () => splitE164(value, countryCode || FALLBACK_COUNTRY),
        // Only the first value matters; later edits come from this component.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const [isoCode, setIsoCode] = useState(initial?.isoCode || countryCode || FALLBACK_COUNTRY);
    const [national, setNational] = useState(initial?.national ?? value.replace(/^\+/, ''));
    // A saved number or a hand-picked code is kept even if the address country changes.
    const pinnedRef = useRef(Boolean(initial));

    useEffect(() => {
        if (pinnedRef.current || !countryCode || countryCode === isoCode || !dialOf(countryCode)) return;
        setIsoCode(countryCode);
        onChange(toE164(countryCode, national));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countryCode]);

    const borderClass = error
        ? 'border-red-500 focus-visible:ring-red-500'
        : 'border-zinc-200 focus-visible:ring-zinc-950';

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium leading-none">{label}</label>
            <div className="flex gap-2">
                <select
                    aria-label={`${label} country code`}
                    value={isoCode}
                    onChange={(e) => {
                        pinnedRef.current = true;
                        setIsoCode(e.target.value);
                        onChange(toE164(e.target.value, national));
                    }}
                    onBlur={onBlur}
                    className={`h-9 w-28 shrink-0 rounded-md border bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 ${borderClass}`}
                >
                    {DIAL_OPTIONS.map((o) => (
                        <option key={o.isoCode} value={o.isoCode}>
                            {o.flag} +{o.dial} {o.name}
                        </option>
                    ))}
                </select>
                <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={national}
                    onChange={(e) => {
                        setNational(e.target.value);
                        onChange(toE164(isoCode, e.target.value));
                    }}
                    onBlur={onBlur}
                    className={`flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 ${borderClass}`}
                />
            </div>
            {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>
    );
}
