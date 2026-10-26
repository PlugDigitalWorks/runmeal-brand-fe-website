import { api, authApi, AUTH_API_URL, AUTH_CLIENT, postSessionRefresh } from '@/lib/axios';
import {
  LoginDto,
  RegisterDto,
  AuthResponse,
  User,
  ApiResponse,
  ResetPasswordDto,
  RefreshResponse,
  OAuthLoginStartResponse,
  OAuthProvider,
  OtpRequestResponse,
  VerifyOtpDto,
} from '@/types/auth';
import Cookies from 'js-cookie';
import { removeWebPushSubscription } from '@/lib/web-push';
import { signupBranchHeaders } from '@/lib/branch-store';

const unwrapAuthData = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
};

const persistAuthResponse = (data: AuthResponse) => {
  const { accessToken, refreshToken, sid, user } = data;

  Cookies.set('accessToken', accessToken);
  if (refreshToken) Cookies.set('refreshToken', refreshToken);
  if (sid) Cookies.set('sid', sid);

  if (user) {
    Cookies.set('user', JSON.stringify(user));
  } else {
    console.error('No user object found in login response');
  }
};

const persistRefreshResponse = (data: RefreshResponse) => {
  Cookies.set('accessToken', data.accessToken);
  if (data.refreshToken) Cookies.set('refreshToken', data.refreshToken);
  if (data.sid) Cookies.set('sid', data.sid);
};

const persistUser = (user: User) => {
  Cookies.set('user', JSON.stringify(user));
};

/**
 * A handoff code is single-use, so a second exchange for the same code (e.g.
 * React StrictMode running the callback effect twice) shares the first call
 * instead of failing with AUTH_GOOGLE_HANDOFF_INVALID / AUTH_APPLE_HANDOFF_INVALID.
 */
let pendingHandoff: { provider: OAuthProvider; code: string; promise: Promise<AuthResponse> } | null = null;

const exchangeHandoff = (provider: OAuthProvider, code: string): Promise<AuthResponse> => {
  if (pendingHandoff?.provider === provider && pendingHandoff.code === code) return pendingHandoff.promise;

  const promise = authApi
    .post<ApiResponse<AuthResponse> | AuthResponse>(`/auth/${provider}/exchange`, { handoff: code })
    .then((response) => unwrapAuthData(response.data));
  pendingHandoff = { provider, code, promise };
  return promise;
};

/**
 * The sign-up body the API accepts — anything else is a 400 VALIDATION_FAILED.
 * The branch goes as a header instead (`signupBranchHeaders`).
 */
const toRegisterBody = ({ email, firstName, lastName, password, country }: RegisterDto): RegisterDto => ({
  email,
  firstName,
  lastName,
  ...(password ? { password } : {}),
  ...(country ? { country } : {}),
});

const isOAuthMethod = (method?: string): method is OAuthProvider => method === 'google' || method === 'apple';

export const authService = {
  async register(data: RegisterDto) {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', toRegisterBody(data), {
      headers: signupBranchHeaders(),
    });
    return response.data.data;
  },

  async forgotPassword(email: string) {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email });
    return response.data;
  },

  async verifyEmail(token: string) {
    const response = await api.get<ApiResponse<{ message: string }>>(`/auth/verify-email`, {
        params: { token }
    });
    return response.data;
  },

  async resetPassword(data: ResetPasswordDto) {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/reset-password', data);
    return response.data;
  },

  async login(data: LoginDto) {
    const response = await authApi.post<ApiResponse<AuthResponse>>('/auth/login', {
      ...data,
      method: data.method || 'password',
      client: data.client || AUTH_CLIENT,
    }, isOAuthMethod(data.method) ? { headers: signupBranchHeaders() } : undefined);

    persistAuthResponse(response.data.data);

    return response.data.data;
  },

  async requestOtpLogin(email: string, recaptchaToken?: string) {
    const response = await authApi.post<ApiResponse<OtpRequestResponse> | OtpRequestResponse>('/auth/login', {
      email,
      method: 'otp',
      client: AUTH_CLIENT,
      ...(recaptchaToken ? { recaptchaToken } : {}),
    });

    return unwrapAuthData(response.data);
  },

  async registerWithOtp(data: Omit<RegisterDto, 'password'>) {
    const response = await api.post<ApiResponse<OtpRequestResponse> | OtpRequestResponse>(
      '/auth/register',
      toRegisterBody(data),
      { headers: signupBranchHeaders() },
    );
    return unwrapAuthData(response.data);
  },

  async verifyOtp(data: VerifyOtpDto) {
    const response = await api.post<ApiResponse<AuthResponse> | AuthResponse>('/auth/verify-otp', {
      ...data,
      client: AUTH_CLIENT,
    });
    const authResponse = unwrapAuthData(response.data);
    persistAuthResponse(authResponse);
    return authResponse;
  },

  /**
   * Silently opens a throwaway CUSTOMER account so a QR table journey can use
   * the backend cart/order endpoints without a signup.
   *
   * Sent in `x-auth-mode: body` like every other call here, so the returned
   * tokens land in the same cookies and the shared refresh interceptor keeps
   * working unchanged. The session has a hard five-hour lifetime that
   * refreshing does not extend.
   */
  async createGuestSession() {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/guest-session', {});

    // The endpoint answers with the same trimmed user shape as login —
    // `{ id, email, firstName, lastName, fullName, role }` — and a guest even
    // carries the ordinary CUSTOMER role, so nothing in the payload says it is
    // a guest. Stamping it here is safe because this call is the *only* way
    // the app opens a guest session; a real login later overwrites the same
    // cookie with a user that has no flag.
    const data: AuthResponse = {
      ...response.data.data,
      user: { ...response.data.data.user, isGuest: true },
    };

    persistAuthResponse(data);

    return data;
  },

  /**
   * Google and Apple start the same way; the response also sets the provider's
   * binding cookie. A first sign-in opens the account, so the branch goes along.
   */
  async startOAuthLogin(provider: OAuthProvider) {
    const response = await authApi.post<ApiResponse<OAuthLoginStartResponse>>(
      '/auth/login',
      { method: provider, client: AUTH_CLIENT },
      { headers: signupBranchHeaders() },
    );

    return response.data.data;
  },

  /**
   * Renews the session from whatever this client holds.
   *
   * In `x-auth-mode: body` the rotated `refreshToken`/`sid` live in readable
   * cookies and must be sent back. The Google flow instead leaves HTTP-only
   * cookies that JS cannot read, so the body is empty there and the backend
   * falls back to them — both modes go through this one call.
   */
  async refreshSessionFromCookies() {
    const refreshToken = Cookies.get('refreshToken');
    const sid = Cookies.get('sid');

    const response = await postSessionRefresh<ApiResponse<RefreshResponse>>(
      refreshToken && sid ? { refreshToken, sid } : undefined,
    );
    persistRefreshResponse(response.data.data);
    return response.data.data;
  },

  /**
   * Finishes a Google or Apple sign-in from the `handoff` code the API put on
   * the `/login` return URL (`provider` names the exchange route). It must go
   * through the same base as `startOAuthLogin`, whose response set the binding
   * cookie this call needs.
   */
  async completeOAuthLogin(provider: OAuthProvider, handoff?: string) {
    if (handoff) {
      const authResponse = await exchangeHandoff(provider, handoff);
      persistAuthResponse(authResponse);
      return authResponse.user;
    }

    // Temporary: an API that predates the handoff exchange returns only
    // `auth=success` and leaves the refresh cookie itself. Remove once the
    // API with `/auth/google/exchange` is live everywhere.
    await this.refreshSessionFromCookies();
    const response = await api.get<ApiResponse<User>>('/profile');
    persistUser(response.data.data);
    return response.data.data;
  },

  async logout() {
    // While the token still works: detach this browser's push subscription so
    // the next person on it gets nothing. Signing out never waits on it failing.
    await removeWebPushSubscription().catch(() => undefined);
    try {
      // Same base as login/refresh, so the API can clear the refresh cookie it set.
      await api.post('/auth/logout', undefined, { baseURL: AUTH_API_URL });
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      // Always cleanup locally
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      Cookies.remove('sid');
      Cookies.remove('refresh');
      Cookies.remove('user');
      window.location.href = '/login';
    }
  },

  getUser(): User | null {
    const userStr = Cookies.get('user');
    if (!userStr || userStr === 'undefined') return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('JSON Parse error', e);
      return null;
    }
  },
  
  isAuthenticated(): boolean {
      return !!Cookies.get('accessToken');
  }
};
