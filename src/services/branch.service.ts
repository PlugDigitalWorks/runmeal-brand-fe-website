import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import type {
  Branch,
  BranchAvailabilityResponse,
  FulfillmentSlotsResponse,
  ScheduledOrderType,
} from '@/types/branch';

export const branchService = {
  async getNearbyBranches(lat?: number, lng?: number) {
    const { getBrandId } = await import('@/lib/brand-store');
    const brandId = getBrandId();

    const params = new URLSearchParams();
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());
    if (brandId) params.append('brandId', brandId);

    const queryString = params.toString();
    const url = `/branches/nearby/brand${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<ApiResponse<Branch[]>>(url);
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
