import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

import { getBrandId } from './brand-store';
import { getDeviceId } from './device-id';

/** Auth endpoints that must never be decorated or retried by the interceptors. */
const AUTH_BYPASS_PATHS = [
  '/auth/refresh',
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/guest-session',
];

const isAuthBypassUrl = (url?: string) =>
  !!url && AUTH_BYPASS_PATHS.some((path) => url.includes(path));

const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
    : '/api';

export const AUTH_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'x-auth-mode': 'body', // Request tokens in body
  },
});

export const authApi = axios.create({
  baseURL: AUTH_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'x-auth-mode': 'body', // Request tokens in body
  },
});

authApi.interceptors.request.use((config) => {
  const brandId = getBrandId();
  if (brandId) {
    config.headers['x-brand-id'] = brandId;
  }
  const deviceId = getDeviceId();
  if (deviceId) {
    config.headers['x-device-id'] = deviceId;
  }
  return config;
});



api.interceptors.request.use(async (config) => {
  let token: string | undefined;

  // Attach the active brand (resolved on boot from the domain) to every request.
  const brandId = getBrandId();
  if (brandId) {
    config.headers['x-brand-id'] = brandId;
  }

  // Lets the backend bind one refresh session per browser instead of issuing a
  // fresh guest on every scan.
  const deviceId = getDeviceId();
  if (deviceId) {
    config.headers['x-device-id'] = deviceId;
  }

  // Don't intercept auth requests to avoid loops. `guest-session` is public and
  // must not carry a stale Authorization header either.
  if (isAuthBypassUrl(config.url)) {
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

/**
 * Last-resort session recovery, registered by the QR table journey.
 *
 * A guest session has a hard five-hour lifetime that refreshing does not
 * extend, so once it lapses there is nothing left to refresh — the only way
 * back is a brand new guest. Registered as a hook rather than imported
 * directly to keep this module free of app/context dependencies, and left
 * unset outside the table flow: a real customer whose session died must land
 * on the login screen, not be silently downgraded to a guest.
 *
 * Returns the new access token, or null when recovery is not possible.
 */
type SessionRecovery = () => Promise<string | null>;

let sessionRecovery: SessionRecovery | null = null;

export function setSessionRecovery(recovery: SessionRecovery | null) {
  sessionRecovery = recovery;
}

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

      const response = await authApi.post('/auth/refresh', {
        ...(refreshToken && sid ? { refreshToken, sid } : {}),
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

      if (isAuthBypassUrl(originalRequest.url)) {
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
        // Refresh is exhausted. `_retry` is already set, so a 401 on the call
        // below cannot re-enter this branch and loop.
        if (sessionRecovery) {
          try {
            const recoveredToken = await sessionRecovery();
            if (recoveredToken) {
              originalRequest.headers.Authorization = `Bearer ${recoveredToken}`;
              return api(originalRequest);
            }
          } catch (recoveryError) {
            console.error('Session recovery failed', recoveryError);
          }
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
