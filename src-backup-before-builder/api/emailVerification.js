
import { apiClient } from './client';

export async function sendEmailCode(email) {
  const { data } = await apiClient.post(
    '/api/auth/email/send-code',
    { email: email.trim().toLowerCase() }
  );
  return data;
}

export async function verifyEmailCode(email, code) {
  const digits = Array.isArray(code) ? code.join('') : String(code || '');

  const { data } = await apiClient.post(
    '/api/auth/email/verify-code',
    {
      email: email.trim().toLowerCase(),
      code: digits,
    }
  );

  return data;
}
