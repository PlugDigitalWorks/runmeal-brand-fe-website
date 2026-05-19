import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { Branch } from '@/types/branch';

export const branchService = {
  async getNearbyBranches(lat?: number, lng?: number) {
    const { DEFAULT_BRAND_ID } = await import('@/lib/constants');

    const params = new URLSearchParams();
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());
    params.append('brandId', DEFAULT_BRAND_ID);

    const queryString = params.toString();
    const url = `/branches/nearby/brand${queryString ? `?${queryString}` : ''}`;

    const headers = {
      'x-brand-id': DEFAULT_BRAND_ID
    };

    const response = await api.get<ApiResponse<Branch[]>>(url, { headers });
    return response.data.data;
  },

  async getBranchDetails(branchId: string) {
    const response = await api.get<ApiResponse<Branch>>(`/branches/${branchId}`);
    return response.data.data;
  }
};
