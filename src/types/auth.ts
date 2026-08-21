// Identity & Auth types

export interface User {
  userId: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  emailConfirmed: boolean;
}

export interface LoginResponse {
  userId: string;
  token: string;
  need2fa: boolean;
}

export interface Login2faResponse {
  userId: string;
  token: string;
}

export type Login2faType = 'code' | 'recovery';

export interface RegisterResponse {
  userId: string;
  resendAfter: number;
}

export interface EmailConfirmResponse {
  token: string;
}

export interface EmailConfirmResendResponse {
  userId: string;
  resendAfter: number;
}

export interface PasswordForgotResponse {
  email: string;
  resendAfter: number;
}

export interface PasswordResetValidationResponse {
  email: string;
  token: string;
}

export interface TokenRefreshResponse {
  token: string;
}

// Profile types

export interface EmailChangeResponse {
  resendAfter: number;
}

export interface TfaEnableResponse {
  secret: string;
  url: string;
}

export interface TfaConfirmResponse {
  recoveryCodes: string[];
}

export interface RecoveryCodesResponse {
  recoveryCodes: string[];
}

// Navigation state types (for react-router)

export interface ConfirmEmailState {
  userId: string;
  email: string;
  resendAfter: number;
}
