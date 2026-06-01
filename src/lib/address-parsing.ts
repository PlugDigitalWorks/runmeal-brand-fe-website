import { AddressComponent, GeocodedAddress } from '@/components/features/address/LocationPicker';

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

export const getAddressComponent = (components: AddressComponent[], type: string) =>
  components.find((component) => component.types.includes(type))?.long_name || '';

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
