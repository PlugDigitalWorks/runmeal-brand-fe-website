export interface Branch {
  id: string;
  name: string;
  addressText: string;
  deliveryRadiusM: number;
  locationGeog: {
    type: 'Point';
    coordinates: number[]; // [longitude, latitude]
  };
  distanceM?: number;
  brandId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  countryCode: string;
  province: string;
  district: string;
  neighborhood: string;
  street: string;
  buildingNumber: string | null;
  apartmentNumber: string | null;
  postalCode: string | null;
  logoUrl?: string | null;
  bannerUrls?: string[];
  phoneNumber?: string;
  minBasketPrice?: number;

  // New flattened structure
  business_hour?: Record<string, {
    isOpen: boolean;
    timeSlots: { openTime: string; closeTime: string }[];
  }>;
  payment_settings?: {
    isActive: boolean;
    onlineMethods?: {
      card?: { isActive: boolean; provider?: string };
    };
    offlineMethods?: {
      cash?: { isActive: boolean };
      cardOnDelivery?: { isActive: boolean };
    };
  };
  order_type_settings?: {
    delivery?: { isActive: boolean };
    pickup?: { isActive: boolean };
    scheduledDelivery?: { isActive: boolean };
    scheduledPickup?: { isActive: boolean };
    /** QR table ordering; the backend keys this `tableOrder`. */
    tableOrder?: { isActive: boolean };
  };
  adisyo_settings?: {
    paymentMethodMapping?: {
      CASH: number;
      ONLINE_CARD: number;
      CARD_ON_DELIVERY: number;
    }
  };
}

export type AvailabilityReason =
  | 'BRANCH_INACTIVE'
  | 'MANUALLY_CLOSED'
  | 'OUTSIDE_BUSINESS_HOURS'
  | null;

export interface BranchAvailabilityResponse {
  canAcceptOrders: boolean;
  reason: AvailabilityReason;
}

export type ScheduledOrderType = 'SCHEDULED_DELIVERY' | 'SCHEDULED_PICKUP';

export interface FulfillmentSlot {
  label: string;
  /** Opaque backend value. Never parse or normalize this in the browser. */
  value: string;
}

export interface FulfillmentSlotsResponse {
  orderType: ScheduledOrderType;
  available: boolean;
  dates: Array<{
    date: string;
    slots: FulfillmentSlot[];
  }>;
}

export interface BranchDetails {
  workingHours: string;
  minimumDeliveryAmount: number;
  paymentMethods: string[];
  deliveryOptions: string[];
  phoneNumber: string;
}
