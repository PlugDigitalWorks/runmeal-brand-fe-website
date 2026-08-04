import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { CmsNavigation, PublicContentPage } from '@/types/cms';

/**
 * Host to resolve the brand with when the domain router Worker is not in front
 * of the app. The API rejects `?host=` in production, so this is dev only and
 * empty everywhere else.
 */
const DEV_HOST = process.env.NEXT_PUBLIC_BRAND_HOST || '';

const hostParams = () => (DEV_HOST ? { host: DEV_HOST } : undefined);

/**
 * Public CMS reads. These endpoints resolve the brand from the request itself —
 * the Worker's tenant headers, else the browser Origin/Referer — so they must be
 * called from the browser through the relative `/api` path, exactly like
 * `resolveBrand()`. `x-brand-id` rides along from the axios interceptor and is
 * ignored here by design.
 */
export const cmsService = {
  async getNavigation() {
    const response = await api.get<ApiResponse<CmsNavigation>>(
      '/public/cms/content-pages/navigation',
      { params: hostParams() }
    );
    const data = response.data.data;
    return {
      header: data?.header ?? [],
      footer: data?.footer ?? []
    };
  },

  async getPage(slug: string) {
    const response = await api.get<ApiResponse<PublicContentPage>>(
      `/public/cms/content-pages/${encodeURIComponent(slug)}`,
      { params: hostParams() }
    );
    return response.data.data;
  }
};
