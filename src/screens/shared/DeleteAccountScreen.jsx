// Delete Account — port of the web pages/site/DeleteAccountPage.jsx (signed-in
// part) and components/accountDeletion/DeleteAccountForm.jsx. Opened from the
// Delete Account section of every role's profile screen.
//
// The form is filled in from the signed-in account (GET /account/deletion-form).
// Deleting needs the registered e-mail verified (the server's status; the
// e-mail section is shown until it is), the details to match the account, a
// reason, the checkbox ticked and DELETE typed exactly; the server checks all of
// it again. POST /account/delete then deletes the account at once and ends every
// session, so the app signs out.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Check, Trash2 } from 'lucide-react-native'
import { StackScreenShell, Section } from '../../components/builder/BuilderUi'
import { SelectField, TextField, FormNotice } from '../../components/form'
import EmailSection from '../../components/EmailSection'
import DeletionPolicy from '../../components/accountDeletion/DeletionPolicy'
import { FALLBACK_ROLES } from '../../components/accountDeletion/policyText'
import { deleteOwnAccount, fetchDeletionForm } from '../../api/accountDeletion'
import { logoutUser } from '../../store/authSlice'
import { useLanguage } from '../../i18n/LanguageContext'
import { EMAIL_PATTERN } from '../../utils/profileValidation'
import { createStyles } from '../../theme/createStyles'

const EMPTY_FORM = { email: '', phone: '', role: '', reasonCode: '', reasonDetails: '', agree: false, confirmText: '' }
const REASON_OTHER = 'OTHER'
// Typed exactly, capitals and all; the server checks it too.
const CONFIRMATION_WORD = 'DELETE'

const digits = (value) => String(value || '').replace(/\D/g, '')

function samePhone(entered, registered) {
  const a = digits(entered)
  const b = digits(registered)
  return Boolean(a && b) && (a === b || (Math.min(a.length, b.length) >= 10 && a.slice(-10) === b.slice(-10)))
}

export default function DeleteAccountScreen({ navigation }) {
  const { t, td } = useLanguage()
  const dispatch = useDispatch()
  const [formData, setFormData] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // Verifying the address below updates the account in the store; the form is
  // then fetched again, so the status shown is the server's.
  const sessionEmail = useSelector((state) => state.auth.user?.email || '')
  const sessionVerified = useSelector((state) => Boolean(state.auth.user?.email_verified))

  useEffect(() => {
    let active = true
    setLoadFailed(false)
    fetchDeletionForm()
      .then((data) => {
        if (!active) return
        setFormData(data)
        // First load: fill from the account. Later loads keep what was typed.
        setForm((current) => (current === EMPTY_FORM
          ? { ...EMPTY_FORM, email: data.account.email || '', phone: data.account.phone || '', role: data.account.role || '' }
          : { ...current, email: data.account.email || '' }))
      })
      .catch(() => { if (active) setLoadFailed(true) })
    return () => { active = false }
  }, [sessionEmail, sessionVerified])

  const account = formData?.account || {}
  const roles = formData?.roles?.length ? formData.roles : FALLBACK_ROLES
  const reasons = formData?.reasons || []
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))

  const emailError = account.email
    ? (!EMAIL_PATTERN.test(form.email.trim()) ? t('account.deleteContactInvalid')
      : form.email.trim().toLowerCase() !== account.email.toLowerCase() ? t('account.deleteEmailMismatch') : '')
    : ''
  const phoneError = samePhone(form.phone, account.phone) ? '' : t('account.deletePhoneMismatch')
  const roleError = form.role && form.role !== account.role ? t('account.deleteRoleMismatch') : ''
  const detailsMissing = form.reasonCode === REASON_OTHER && !form.reasonDetails.trim()
  const emailVerified = Boolean(account.email && account.email_verified)
  const confirmTyped = form.confirmText === CONFIRMATION_WORD
  const canDelete = Boolean(formData) && emailVerified && !emailError && !phoneError && Boolean(form.role) && !roleError
    && Boolean(form.reasonCode) && !detailsMissing && form.agree && confirmTyped && !deleting

  async function submit() {
    if (!canDelete) return
    setDeleting(true)
    setErrorMessage('')
    try {
      await deleteOwnAccount({
        full_name: account.name,
        role: form.role,
        email: account.email ? form.email.trim() : null,
        phone: form.phone.trim(),
        reason_code: form.reasonCode,
        reason_details: form.reasonDetails.trim() || null,
        confirm_deletion: form.agree,
        confirmation_text: form.confirmText,
      })
      // The server has ended every session; this clears the app's copy.
      Alert.alert(t('account.deleteDone'), t('account.deleteDoneSub'), [{ text: t('account.deleteClose') }])
      dispatch(logoutUser())
    } catch (error) {
      // The server rolls back on failure: the account and the session are as they were.
      const detail = error?.response?.data?.detail
      const message = Array.isArray(detail) ? null : (detail && typeof detail === 'object' ? detail.message : detail)
      setErrorMessage((message && td(String(message))) || t('account.deleteFailed'))
      setDeleting(false)
    }
  }

  const reasonOptions = reasons.map((reason) => {
    // A reason the server adds before it has a translation shows its own label.
    const key = `account.reason.${reason.value}`
    const translated = t(key)
    return { value: reason.value, label: translated === key ? reason.label : translated }
  })

  return (
    <StackScreenShell title={t('account.delete')} subtitle={t('account.deleteSub')} onBack={() => navigation.goBack()}>
      <Section>
        {!formData ? (
          <Text style={styles.muted}>{loadFailed ? t('account.deleteFailed') : '…'}</Text>
        ) : (
          <View style={styles.card}>
            <View style={styles.head}>
              <View style={styles.headIcon}><Trash2 size={18} color="#e11d48" /></View>
              <Text style={styles.headTitle}>{t('account.deleteTitle')}</Text>
            </View>

            {!emailVerified ? (
              <View style={styles.block}>
                <FormNotice tone="warning" message={t('account.deleteVerifyEmail')} />
                <EmailSection />
              </View>
            ) : null}

            <Text style={styles.legend}>{t('account.deleteAccountInfo')}</Text>
            <TextField label={t('account.deleteFullName')} value={account.name || ''} editable={false} />
            <SelectField
              label={t('account.deleteRole')}
              value={form.role}
              options={roles.map((role) => ({ value: role.value, label: role.label }))}
              onChange={update('role')}
              placeholder={t('account.deleteRoleChoose')}
              error={roleError}
            />
            {account.email ? (
              <TextField
                label={t('account.deleteEmail')}
                value={form.email}
                onChangeText={update('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                maxLength={255}
                error={emailError && form.email ? emailError : ''}
              />
            ) : (
              <TextField label={t('account.deleteEmail')} value={t('account.deleteNoEmail')} editable={false} />
            )}
            <TextField
              label={t('account.deleteMobile')}
              value={form.phone}
              onChangeText={update('phone')}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={30}
              error={phoneError && form.phone ? phoneError : ''}
            />

            <SelectField
              label={t('account.deleteReason')}
              value={form.reasonCode}
              options={reasonOptions}
              onChange={update('reasonCode')}
              placeholder={t('account.deleteReasonChoose')}
            />
            <TextField
              label={t('account.deleteReasonDetails')}
              value={form.reasonDetails}
              onChangeText={update('reasonDetails')}
              multiline
              maxLength={1000}
              error={detailsMissing ? t('account.deleteReasonDetailsRequired') : ''}
            />

            <DeletionPolicy />

            <Pressable
              onPress={() => update('agree')(!form.agree)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: form.agree }}
              style={styles.agree}
            >
              <View style={[styles.box, form.agree ? styles.boxOn : null]}>
                {form.agree ? <Check size={13} color="#ffffff" /> : null}
              </View>
              <Text style={styles.agreeText}>{t('account.deleteAgree')}</Text>
            </Pressable>

            <TextField
              label={t('account.deleteConfirmLabel')}
              value={form.confirmText}
              onChangeText={update('confirmText')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              maxLength={50}
              error={form.confirmText && !confirmTyped ? t('account.deleteConfirmMismatch') : ''}
            />

            <FormNotice tone="error" message={errorMessage} />

            <View style={styles.actions}>
              <Pressable onPress={() => navigation.goBack()} disabled={deleting} style={[styles.cancel, deleting ? styles.dim : null]}>
                <Text style={styles.cancelText}>{t('dash.common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canDelete}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canDelete }}
                style={[styles.danger, !canDelete ? styles.dim : null]}
              >
                <Trash2 size={14} color="#ffffff" />
                <Text style={styles.dangerText}>{deleting ? t('account.deleting') : t('account.delete')}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Section>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  muted: { padding: 16, fontSize: 13.5, fontWeight: '600', color: c.textMuted },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.card, padding: 16 },
  head: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.roseSoft },
  headTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: c.text },
  block: { marginBottom: 16, gap: 10 },
  legend: { marginBottom: 8, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  agree: {
    marginTop: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12,
    borderWidth: 1, borderColor: c.amberBorder, backgroundColor: c.amberSoft, padding: 12,
  },
  box: {
    marginTop: 1, width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: c.borderStrong,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.card,
  },
  boxOn: { borderColor: '#e11d48', backgroundColor: '#e11d48' },
  agreeText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: c.amberTextStrong },
  actions: { marginTop: 6, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancel: { height: 40, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
  cancelText: { fontSize: 13, fontWeight: '800', color: c.text },
  danger: { height: 40, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e11d48' },
  dangerText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  dim: { opacity: 0.5 },
}))
