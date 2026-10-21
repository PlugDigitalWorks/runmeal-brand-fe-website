export interface Address {
  id: string;
  countryCode: string;
  province: string;
  district: string;
  neighborhood?: string;
  phoneE164?: string | null;
  postalCode: string;
  street: string;
  buildingNumber: string | null;
  /** Free-text note for the courier ("Doorbell broken, please call"); null when none. */
  note?: string | null;
  latitude: number;
  longitude: number;
  isActive: boolean;
  locationGeog?: {
    type: string;
    coordinates: number[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAddressDto {
  countryCode: string;
  province: string;
  district: string;
  neighborhood?: string;
  phoneE164?: string;
  postalCode: string;
  street: string;
  buildingNumber?: string | null;
  /** At most 500 characters; "" clears it. */
  note?: string;
  latitude: number;
  longitude: number;
  isActive?: boolean;
  title?: string;
}

export interface UpdateAddressDto extends Partial<CreateAddressDto> {
  isActive?: boolean;
}
