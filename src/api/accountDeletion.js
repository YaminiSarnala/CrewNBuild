import { apiClient } from './client'

// Port of the web services/accountDeletion.js. The account is always the
// session's own; DELETE /account is retired (410) in favour of these two.

// Profile > Delete Account: the form, filled in from the account
// ({ account: { name, role, email, phone, email_verified }, roles, reasons, support_email }).
export const fetchDeletionForm = async () => (await apiClient.get('/account/deletion-form')).data

// Deletes the signed-in account immediately and ends every session. Irreversible.
export const deleteOwnAccount = async (payload) => (await apiClient.post('/account/delete', payload)).data
