import { City, Country, State } from 'country-state-city';

import {
  AddressComponentLike,
  getAddressComponent,
  getAddressShortName,
  normalizeLocationName,
} from './address-parsing';

/** The three location fields the address form keeps as select values. */
export interface AddressRegion {
  countryCode: string;
  province: string;
  district: string;
}

interface RegionInput {
  /** ISO code or country name, in any language Google or Cloudflare use. */
  countries: string[];
  /** Province/state candidates, most likely first. */
  regions: string[];
  /** District/city candidates, most likely first. */
  cities: string[];
}

const clean = (values: string[]) => values.map((value) => value?.trim()).filter(Boolean) as string[];

const sameName = (a: string, b: string) => normalizeLocationName(a) === normalizeLocationName(b);

/** First item matched by the earliest candidate, so candidate order decides ties. */
const findByCandidates = <T>(items: T[], candidates: string[], matches: (item: T, candidate: string) => boolean) => {
  for (const candidate of candidates) {
    const found = items.find((item) => matches(item, candidate));
    if (found) return found;
  }
  return undefined;
};

/**
 * Maps free-form place names onto the country-state-city dataset behind the
 * form's selects. An unmatched name is kept only where the form shows a
 * free-text field (the dataset has no options at that level); next to a
 * select it would be a value the customer cannot see, so it is left empty.
 */
export function resolveAddressRegion(input: RegionInput, fallbackCountry: string): AddressRegion {
  const countries = clean(input.countries);
  const regions = clean(input.regions);
  const cities = clean(input.cities);

  const allCountries = Country.getAllCountries();
  const matchedCountry =
    findByCandidates(allCountries, countries, (country, value) => value.toUpperCase() === country.isoCode) ||
    findByCandidates(allCountries, countries, (country, value) => sameName(value, country.name)) ||
    (countries.some((value) => ['turkiye', 'turkey'].includes(normalizeLocationName(value)))
      ? allCountries.find((country) => country.isoCode === 'TR')
      : undefined);
  // Never silently switch country; keep the current one when nothing matched.
  const countryCode = matchedCountry?.isoCode || fallbackCountry;

  const states = State.getStatesOfCountry(countryCode);
  const matchedState =
    findByCandidates(states, regions, (state, value) => sameName(value, state.name) || value === state.isoCode) ||
    findByCandidates(states, regions, (state, value) =>
      normalizeLocationName(state.name).includes(normalizeLocationName(value)),
    );

  const stateCities = matchedState ? City.getCitiesOfState(countryCode, matchedState.isoCode) : [];
  const matchedCity = findByCandidates(stateCities, cities, (city, value) => sameName(value, city.name));

  const province = matchedState?.name || (states.length === 0 ? regions[0] || '' : '');
  const district = matchedCity?.name || (stateCities.length === 0 && province ? cities[0] || '' : '');

  return { countryCode, province, district };
}

/** Region fields from a Google geocoder / Places result. */
export function resolveRegionFromGoogle(components: AddressComponentLike[], fallbackCountry: string) {
  return resolveAddressRegion(
    {
      countries: [getAddressShortName(components, 'country'), getAddressComponent(components, 'country')],
      regions: [getAddressComponent(components, 'administrative_area_level_1')],
      // `postal_town` is where the UK puts the town Google elsewhere calls `locality`.
      cities: [
        getAddressComponent(components, 'locality'),
        getAddressComponent(components, 'postal_town'),
        getAddressComponent(components, 'administrative_area_level_2'),
        getAddressComponent(components, 'sublocality'),
      ],
    },
    fallbackCountry,
  );
}
