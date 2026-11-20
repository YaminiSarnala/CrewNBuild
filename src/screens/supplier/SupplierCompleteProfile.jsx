// A supplier's Complete Profile (web CompleteProfilePage with SupplierProfileSteps).
// Opened by useProfileGate like every role's; it prefills from the saved
// supplier profile so a returning supplier never sends blanks over it, and
// saving returns to the screen that asked and replays its action.
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowRight } from 'lucide-react-native'
import { PanelState, Panel } from '../../components/DashboardShell'
import { Section, StackScreenShell } from '../../components/builder/BuilderUi'
import Toast, { useToast } from '../../components/Toast'
import { PrimaryButton } from '../../components/ui'
import { completeUserProfile } from '../../api/auth'
import { mergeUser } from '../../store/authSlice'
import { clearPendingProfileAction, takePendingProfileAction } from '../../hooks/useProfileGate'
import { useLanguage } from '../../i18n/LanguageContext'
import { apiErrorText } from '../../utils/builderHelpers'
import { fieldErrorsFrom } from '../../utils/profileValidation'
import { useSupplier } from './SupplierContext'
import { SupplierProfileFields, useSupplierProfileForm } from './supplierProfileForm'

export default function SupplierCompleteProfile({ navigation }) {
  const { t, td } = useLanguage()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const { profile, status, reload } = useSupplier()
  const formState = useSupplierProfileForm(profile, user)
  const [saving, setSaving] = useState(false)
  // Errors show as a toast at the bottom, where the Submit button is, and the
  // field at fault is highlighted in the form.
  const { toast, showToast, hideToast } = useToast()
  const scrollRef = useRef(null)
  // 'missing' = no supplier profile yet: nothing saved to keep, the form starts empty.
  const ready = status === 'ready' || status === 'missing'
  const seeded = useRef(false)

  useEffect(() => {
    // Leaving without saving drops the action that was waiting on this form.
    return () => clearPendingProfileAction()
  }, [])

  // Prefill once the saved profile is known.
  useEffect(() => {
    if (!ready || seeded.current) return
    seeded.current = true
    formState.reset(profile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profile])

  // The e-mail added and verified in the form clears its highlight.
  useEffect(() => {
    if (user?.email) formState.setErrors((current) => (current?.email ? { ...current, email: undefined } : current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  async function submit() {
    if (saving) return
    if (!ready) {
      showToast(t(status === 'error' ? 'cp.loadSavedFailed' : 'cp.loadingSaved'), 'error')
      return
    }
    const errors = Object.fromEntries(Object.entries(formState.validate()).map(([key, value]) => [key, td(String(value))]))
    // A phone-first account has no e-mail yet, and the completion rule needs one:
    // it is added and verified in the e-mail field at the top of the form.
    const emailMissing = !user?.email
    if (emailMissing) errors.email = t('emailVerify.needEmail')
    if (Object.keys(errors).length) {
      formState.setErrors(errors)
      const onlyEmail = emailMissing && Object.keys(errors).length === 1
      showToast(onlyEmail ? t('emailVerify.needEmail') : t('cp.val.completeFields'), 'error')
      // The e-mail field is near the top: bring it into view.
      if (emailMissing) scrollRef.current?.scrollTo({ y: 0, animated: true })
      return
    }
    setSaving(true)
    hideToast()
    try {
      const updated = await completeUserProfile(formState.payload())
      dispatch(mergeUser(updated?.user || updated || {}))
      await reload()
      const resume = takePendingProfileAction()
      if (navigation.canGoBack()) navigation.goBack()
      // Let the asking screen come back into focus before replaying its action.
      if (resume) setTimeout(resume, 350)
    } catch (error) {
      const fields = fieldErrorsFrom(error)
      formState.setErrors(Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, td(String(value))])))
      showToast(td(apiErrorText(error, t('cp.err.completeProfile'))), 'error')
      setSaving(false)
    }
  }

  return (
    <>
    <StackScreenShell
      title={t('ps.sup.setupLabel')}
      subtitle={t('ps.sup.setupSubtitle')}
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : null)}
      scrollRef={scrollRef}
    >
      {ready ? (
        <>
          <SupplierProfileFields state={formState} email={user?.email} addEmail />
          <Section style={{ marginBottom: 14 }}>
            <PrimaryButton
              label={t('cp.submitProfile')}
              onPress={submit}
              loading={saving}
              disabled={saving}
              icon={<ArrowRight size={16} color="#ffffff" />}
              full
            />
          </Section>
        </>
      ) : (
        <Panel title={t('ps.sup.setupLabel')}>
          <PanelState loading={status !== 'error'} error={status === 'error' ? t('cp.loadSavedFailed') : ''} empty={false} />
        </Panel>
      )}
    </StackScreenShell>
    <Toast {...toast} onHide={hideToast} />
    </>
  )
}
