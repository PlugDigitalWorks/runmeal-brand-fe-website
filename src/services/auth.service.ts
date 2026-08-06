import { api, authApi } from '@/lib/axios';
import {
  LoginDto,
  RegisterDto,
  AuthResponse,
  User,
  ApiResponse,
  ResetPasswordDto,
  RefreshResponse,
  GoogleLoginStartResponse,
} from '@/types/auth';
import Cookies from 'js-cookie';

const AUTH_CLIENT = 'user';

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

export const authService = {
  async register(data: RegisterDto) {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
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
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      ...data,
      method: data.method || 'password',
      client: data.client || AUTH_CLIENT,
    });

    persistAuthResponse(response.data.data);

    return response.data.data;
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

  async startGoogleLogin() {
    const response = await authApi.post<ApiResponse<GoogleLoginStartResponse>>(
      '/auth/login',
      { method: 'google', client: AUTH_CLIENT },
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

    const response = await authApi.post<ApiResponse<RefreshResponse>>(
      '/auth/refresh',
      refreshToken && sid ? { refreshToken, sid } : {},
    );
    persistRefreshResponse(response.data.data);
    return response.data.data;
  },

  async completeGoogleLogin() {
    await this.refreshSessionFromCookies();
    const response = await api.get<ApiResponse<User>>('/profile');
    persistUser(response.data.data);
    return response.data.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
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
