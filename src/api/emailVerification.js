
import { apiClient } from './client';

export async function sendEmailCode(email) {
  const { data } = await apiClient.post(
    '/auth/email/send-code',
    { email: email.trim().toLowerCase() }
  );
  return data;
}

export async function verifyEmailCode(email, code) {
  const digits = Array.isArray(code) ? code.join('') : String(code || '');

  const { data } = await apiClient.post(
    '/auth/email/verify-code',
    {
      email: email.trim().toLowerCase(),
      code: digits,
    }
  );

  return data;
}

// Profile Settings (port of the web's sendProfileEmailCode/verifyProfileEmailCode):
// the signed-in account adds or changes its e-mail. The address is saved on
// the account, verified, only once the e-mailed code checks out; the reply is
// { user } with the updated account.
export async function sendProfileEmailCode(email) {
  const { data } = await apiClient.post('/auth/email/profile/send-code', { email: email.trim().toLowerCase() });
  return data;
}

export async function verifyProfileEmailCode(email, code) {
  const digits = Array.isArray(code) ? code.join('') : String(code || '');
  const { data } = await apiClient.post('/auth/email/profile/verify-code', { email: email.trim().toLowerCase(), code: digits });
  return data;
}
