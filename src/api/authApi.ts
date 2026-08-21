/**
 * Identity / Authentication API functions.
 */

import { apiPost } from './client';
import { clearTokens, notifyRustLogin, getServerUrl } from './tokenManager';
import type {
  LoginResponse,
  Login2faResponse,
  Login2faType,
  RegisterResponse,
  EmailConfirmResponse,
  EmailConfirmResendResponse,
  PasswordForgotResponse,
  PasswordResetValidationResponse,
} from '../types/auth';

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await apiPost<LoginResponse>('/identity/login', {
      email,
      password,
    });
    // If login succeeded without 2FA, also proxy through Rust so its cookie
    // jar picks up the refresh token cookie for the fallback path.
    if (!res.need2fa) {
      const serverUrl = getServerUrl();
      if (serverUrl) {
        notifyRustLogin(serverUrl, email, password);
      }
    }
    return res;
  },

  login2fa: async (
    userId: string,
    token: string,
    code: string,
    type: Login2faType = 'code',
  ): Promise<Login2faResponse> => {
    const res = await apiPost<Login2faResponse>('/identity/login-2fa', {
      userId,
      token,
      code,
      type,
    });
    // Access token is auto-stored by client.ts
    return res;
  },

  register: async (
    name: string,
    email: string,
    password: string,
  ): Promise<RegisterResponse> => {
    return apiPost<RegisterResponse>('/identity/register', {
      name,
      email,
      password,
    });
  },

  emailConfirm: async (
    userId: string,
    code: string,
  ): Promise<EmailConfirmResponse> => {
    // Token is auto-stored by client.ts
    return apiPost<EmailConfirmResponse>('/identity/email-confirm', {
      userId,
      code,
    });
  },

  emailConfirmResend: async (
    userId: string,
  ): Promise<EmailConfirmResendResponse> => {
    return apiPost<EmailConfirmResendResponse>(
      '/identity/email-confirm-resend',
      { userId },
    );
  },

  passwordForgot: async (email: string): Promise<PasswordForgotResponse> => {
    return apiPost<PasswordForgotResponse>('/identity/password-forgot', {
      email,
    });
  },

  passwordResetValidation: async (
    email: string,
    code: string,
  ): Promise<PasswordResetValidationResponse> => {
    return apiPost<PasswordResetValidationResponse>(
      '/identity/password-reset-validation',
      { email, code },
    );
  },

  passwordReset: async (
    email: string,
    token: string,
    password: string,
  ): Promise<void> => {
    await apiPost('/identity/password-reset', { email, token, password });
  },

  logout: async (): Promise<void> => {
    try {
      await apiPost('/identity/token/revoke');
    } catch {
      // Ignore revoke errors — we clear locally regardless
    }
    clearTokens();
    // Also clear Rust-side cookies
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('clear_auth_cookies');
    } catch {
      // Non-critical
    }
  },
};
