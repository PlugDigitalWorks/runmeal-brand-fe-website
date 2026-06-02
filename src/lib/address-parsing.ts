import type { GeocodedAddress } from '@/components/features/address/LocationPicker';
import type { Address, CreateAddressDto } from '@/types/address';

export interface AddressComponentLike {
  long_name?: string;
  short_name?: string;
  longText?: string | null;
  shortText?: string | null;
  types: string[];
}

export interface DeliveryAddressSelection {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  addressComponents?: AddressComponentLike[];
}

export const normalizeLocationName = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();

const looksLikeStreetSegment = (segment: string) =>
  /(cad|caddesi|sok|sokak|sk\.|mah|mahalle|bulvar|blv|street|st\.|avenue|ave|road|rd\.|no[:.\s]*\d)/i.test(
    segment,
  );

const getComponentText = (component?: AddressComponentLike) =>
  component?.long_name ||
  component?.longText ||
  component?.short_name ||
  component?.shortText ||
  '';

export const getAddressComponent = (components: AddressComponentLike[], type: string) =>
  getComponentText(components.find((component) => component.types.includes(type)));

const isCountrySegment = (segment: string) => {
  const normalized = normalizeLocationName(segment);
  return normalized === 'turkiye' || normalized === 'turkey' || normalized === 'tr';
};

const validAddressField = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= 2 ? trimmed : fallback;
};

const getFormattedSegments = (formattedAddress: string) =>
  formattedAddress
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

export const extractStreetAndBuilding = (address: GeocodedAddress) => {
  const components = address.address_components;
  const route = getAddressComponent(components, 'route');
  const streetNumber = getAddressComponent(components, 'street_number');
  const neighborhood = getAddressComponent(components, 'neighborhood');
  const sublocality = getAddressComponent(components, 'sublocality');
  const administrativeAreaLevel2 = getAddressComponent(components, 'administrative_area_level_2');
  const locality = getAddressComponent(components, 'locality');
  const premise = getAddressComponent(components, 'premise');

  const segments = address.formatted_address
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const streetSegment =
    route ||
    segments.find(looksLikeStreetSegment) ||
    neighborhood ||
    sublocality ||
    premise ||
    administrativeAreaLevel2 ||
    locality ||
    '';

  const street = route || streetSegment;
  const building =
    streetNumber ||
    streetSegment.match(/\bNo[:.\s-]*([0-9A-Za-z/-]+)/i)?.[1] ||
    streetSegment.match(/\b([0-9A-Za-z/-]+)\b$/)?.[1] ||
    '';

  return {
    street: street.replace(/\s*\bNo[:.\s-]*[0-9A-Za-z/-]+\b/i, '').trim(),
    building,
  };
};

export const formatSavedAddress = (address: Pick<Address, 'street' | 'district' | 'province'>) =>
  [address.street, address.district, address.province].filter(Boolean).join(', ');

export const buildAddressDtoFromSelection = (
  selection: DeliveryAddressSelection,
): CreateAddressDto => {
  const components = selection.addressComponents || [];
  const segments = getFormattedSegments(selection.formattedAddress);
  const nonCountrySegments = segments.filter((segment) => !isCountrySegment(segment));
  const slashSegment = nonCountrySegments.find((segment) => segment.includes('/'));
  const [slashDistrict, slashProvince] = slashSegment
    ? slashSegment.split('/').map((segment) => segment.trim())
    : ['', ''];

  const route = getAddressComponent(components, 'route');
  const streetNumber = getAddressComponent(components, 'street_number');
  const province =
    getAddressComponent(components, 'administrative_area_level_1') ||
    slashProvince ||
    nonCountrySegments.at(-1) ||
    'Unknown';
  const district =
    getAddressComponent(components, 'administrative_area_level_2') ||
    getAddressComponent(components, 'sublocality_level_1') ||
    getAddressComponent(components, 'sublocality') ||
    slashDistrict ||
    nonCountrySegments[1] ||
    province;
  const neighborhood =
    getAddressComponent(components, 'neighborhood') ||
    getAddressComponent(components, 'administrative_area_level_4') ||
    getAddressComponent(components, 'sublocality_level_2') ||
    (slashDistrict ? nonCountrySegments[1] : '');
  const street =
    route ||
    nonCountrySegments.find(looksLikeStreetSegment) ||
    nonCountrySegments[0] ||
    selection.formattedAddress;
  const countryCode = getAddressComponent(components, 'country');

  return {
    countryCode: countryCode.length === 2 ? countryCode.toUpperCase() : 'TR',
    province: validAddressField(province, 'Unknown'),
    district: validAddressField(district, 'Unknown'),
    neighborhood: neighborhood || undefined,
    postalCode: getAddressComponent(components, 'postal_code') || '00000',
    street: validAddressField(street.replace(/\s*\bNo[:.\s-]*[0-9A-Za-z/-]+\b/i, ''), 'Unknown'),
    buildingNumber: streetNumber || '-',
    apartmentNumber: '-',
    latitude: selection.latitude,
    longitude: selection.longitude,
    isActive: true,
  };
};

export const isSameDeliveryLocation = (
  address: Pick<Address, 'latitude' | 'longitude' | 'street' | 'district' | 'province'>,
  selection: DeliveryAddressSelection,
) => {
  const latDelta = Math.abs((address.latitude || 0) - selection.latitude);
  const lngDelta = Math.abs((address.longitude || 0) - selection.longitude);
  const hasStoredCoordinates = Boolean(address.latitude && address.longitude);

  if (hasStoredCoordinates && latDelta < 0.0005 && lngDelta < 0.0005) {
    return true;
  }

  return (
    normalizeLocationName(formatSavedAddress(address)) ===
    normalizeLocationName(selection.formattedAddress)
  );
};
