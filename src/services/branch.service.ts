import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import type {
  Branch,
  BrandBranch,
  BranchAvailabilityResponse,
  FulfillmentSlotsResponse,
  ScheduledOrderType,
} from '@/types/branch';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** `brandId` plus lat/lng — both coordinates or neither, never just one. */
async function brandLocationParams(location?: Coordinates | null) {
  const { getBrandId } = await import('@/lib/brand-store');
  const params: Record<string, string> = { brandId: getBrandId() };
  if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
    params.lat = String(location.latitude);
    params.lng = String(location.longitude);
  }
  return params;
}

export const branchService = {
  /** Only the branches that deliver to the given location. */
  async getNearbyBranches(lat?: number, lng?: number) {
    const params = await brandLocationParams(
      lat === undefined || lng === undefined ? null : { latitude: lat, longitude: lng },
    );
    const response = await api.get<ApiResponse<Branch[]>>('/branches/nearby/brand', { params });
    return response.data.data;
  },

  /**
   * Every open branch of the brand. With a location they come nearest first and
   * carry `distanceM`/`canDeliver`; without one, sorted by name with both null.
   */
  async getBrandBranches(location?: Coordinates | null) {
    const params = await brandLocationParams(location);
    const response = await api.get<ApiResponse<BrandBranch[]>>('/branches/nearby/brand/all', { params });
    return response.data.data;
  },

  async getBranchDetails(branchId: string) {
    const response = await api.get<ApiResponse<Branch>>(`/branches/${branchId}`);
    return response.data.data;
  },

  async getAvailability(branchId: string) {
    const response = await api.get<ApiResponse<BranchAvailabilityResponse>>(
      `/branches/${encodeURIComponent(branchId)}/availability`,
    );
    return response.data.data;
  },

  async getFulfillmentSlots(branchId: string, orderType: ScheduledOrderType) {
    const response = await api.get<ApiResponse<FulfillmentSlotsResponse>>(
      `/branches/${encodeURIComponent(branchId)}/fulfillment-slots`,
      { params: { orderType } },
    );
    return response.data.data;
  },
};
