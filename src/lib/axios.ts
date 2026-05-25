import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

import { DEFAULT_BRAND_ID } from './constants';

const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
    : '/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'x-auth-mode': 'body', // Request tokens in body
    'x-brand-id': DEFAULT_BRAND_ID,
  },
});



api.interceptors.request.use(async (config) => {
  let token: string | undefined;

  // Don't intercept auth requests to avoid loops
  if (config.url?.includes('/auth/refresh') || config.url?.includes('/auth/login')) {
    return config;
  }

  if (typeof window === 'undefined') {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    token = cookieStore.get('accessToken')?.value;
  } else {
    token = Cookies.get('accessToken');
  }



  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryQueueItem {
  resolve: (value?: unknown) => void;
  reject: (error?: unknown) => void;
  config: InternalAxiosRequestConfig;
}

// Queue to hold requests while refreshing token
let isRefreshing = false;
let failedQueue: RetryQueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      if (prom.config.headers) {
        prom.config.headers.Authorization = `Bearer ${token}`;
      }
      prom.resolve(api(prom.config));
    }
  });

  failedQueue = [];
};

// Shared promise for ongoing refresh to avoid race conditions
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (refreshPromise) return refreshPromise;

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      let refreshToken: string | undefined;
      let sid: string | undefined;

      if (typeof window === 'undefined') {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        refreshToken = cookieStore.get('refreshToken')?.value;
        sid = cookieStore.get('sid')?.value;
      } else {
        refreshToken = Cookies.get('refreshToken');
        sid = Cookies.get('sid');
      }

      const response = await axios.post(`${API_URL}/auth/refresh`, {
        ...(refreshToken && sid ? { refreshToken, sid } : {}),
      }, {
        withCredentials: true,
        headers: {
          'x-auth-mode': 'body'
        }
      });

      const data = response.data.data || response.data;
      const { accessToken, refreshToken: newRefresh, sid: newSid } = data;

      Cookies.set('accessToken', accessToken);
      if (newRefresh) Cookies.set('refreshToken', newRefresh);
      if (newSid) Cookies.set('sid', newSid);

      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      // Process queue for 401 retries
      processQueue(null, accessToken);

      return accessToken;
    } catch (error) {
      processQueue(error, null);
      // Clear tokens
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      Cookies.remove('sid');
      Cookies.remove('user');
      // Throw to caller
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {

      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          // Optional: redirect to login
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
