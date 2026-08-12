export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Envelope for endpoints that flatten pagination: `data` is the page itself and
 * `meta` sits beside it, rather than a `data.data` wrapper.
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  meta?: PaginationMeta;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  role: string;
  /**
   * Set on the throwaway account a QR table journey creates. Such a user has
   * the ordinary CUSTOMER role, so `isAuthenticated` alone cannot tell them
   * apart from a signed-in customer — check this before showing account UI.
   */
  isGuest?: boolean;
  isActive?: boolean;
  isEmailVerified?: boolean;
  phoneNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  sid?: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  sid?: string;
}

export type AuthClient = 'user' | 'manager';
export type AuthMethod = 'password' | 'otp' | 'google';

export interface LoginDto {
  email?: string;
  password?: string;
  method?: AuthMethod;
  client?: AuthClient;
  recaptchaToken?: string;
}

export interface OtpRequestResponse {
  message: string;
  method?: 'otp';
}

export interface VerifyOtpDto {
  email: string;
  code: string;
}

export interface GoogleLoginStartResponse {
  method: 'google';
  redirectUrl: string;
}



export interface RegisterDto {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  country?: string;
  role?: string;
  phoneNumber?: string;
  latitude?: string;
  longitude?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}
