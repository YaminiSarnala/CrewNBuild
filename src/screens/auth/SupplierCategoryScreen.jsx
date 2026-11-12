// Port of web pages/auth/SupplierCategoryPage.jsx: the supplier's category step,
// Create Account -> Supplier Category -> Pincode -> Dashboard.
//
// RootNavigator shows only this screen while the server reports
// `supplier_category` missing (supplierCategoryMissing). Continue saves the
// choice (PATCH /auth/supplier-category); nothing moves on until the server
// confirms it, and the saved account then switches the navigator onward.
import { useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowRight, BrickWall, HardHat, Store, Tractor, CheckCircle2 } from 'lucide-react-native'
import { fetchSessionUser, saveSupplierCategory } from '../../api/auth'
import { logoutUser, mergeUser } from '../../store/authSlice'
import { useLanguage } from '../../i18n/LanguageContext'
import { optionLabel, SUPPLIER_TYPE_KEYS } from '../../i18n/optionKeys'
import { PrimaryButton, GhostButton } from '../../components/ui'
import { SUPPLIER_CATEGORY_CHOICES, supplierCategoryMissing } from '../supplier/supplierKinds'
import { useSupplier } from '../supplier/SupplierContext'
import { createStyles } from '../../theme/createStyles'

const CATEGORY_ICONS = {
  'Material Supplier': BrickWall,
  'Equipment Supplier': Tractor,
  'Labor Supplier': HardHat,
}

export default function SupplierCategoryScreen() {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  // The saved category decides the dashboard, so the profile is re-read first.
  const { reload } = useSupplier()
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // One save per press: set before the request leaves, cleared only if it fails.
  const submitting = useRef(false)

  const choose = (value) => {
    setCategory(value)
    setError('')
  }

  async function submit() {
    if (submitting.current) return
    if (!category) {
      setError(t('cp.val.supplierCategory'))
      return
    }
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await saveSupplierCategory(category)
      await reload()
      dispatch(mergeUser(saved?.user || saved || {}))
      return
    } catch (failure) {
      // 409: already saved (another device, a reply that never arrived). The
      // server's account says so, and the navigator moves on.
      if (failure?.response?.status === 409) {
        try {
          const account = await fetchSessionUser()
          if (account && !supplierCategoryMissing(account)) {
            await reload()
            dispatch(mergeUser(account))
            return
          }
        } catch {
          /* falls through to the retry message */
        }
      }
    }
    submitting.current = false
    setSaving(false)
    setError(t('ps.supplierCategorySaveFailed'))
  }

  return (
    <View style={styles.page}>
      <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
        <View style={styles.heroIcon}>
          <Store size={25} color="#ffffff" />
        </View>
        <Text style={styles.heroTitle}>{t('ps.selectSupplierCategory')}</Text>
        {user?.name ? <Text style={styles.heroSub}>{user.name}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 28 }}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('ps.supplierCategory')} style={styles.choices}>
          {SUPPLIER_CATEGORY_CHOICES.map((value) => {
            const Icon = CATEGORY_ICONS[value]
            const selected = category === value
            return (
              <Pressable
                key={value}
                onPress={() => choose(value)}
                disabled={saving}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.choice, selected ? styles.choiceOn : null]}
              >
                <View style={[styles.choiceIcon, selected ? styles.choiceIconOn : null]}>
                  <Icon size={22} color="#2e7d55" />
                </View>
                <Text style={styles.choiceText}>{optionLabel(t, SUPPLIER_TYPE_KEYS, value)}</Text>
                {selected ? <CheckCircle2 size={20} color="#2e7d55" /> : null}
              </Pressable>
            )
          })}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={{ marginTop: 18 }}>
          <PrimaryButton
            label={saving ? t('dash.common.saving') : t('ps.supplierCategoryContinue')}
            icon={<ArrowRight size={17} color="#ffffff" />}
            onPress={submit}
            loading={saving}
            disabled={saving}
            full
          />
        </View>
        <View style={{ marginTop: 10 }}>
          <GhostButton label={t('ui.logout')} onPress={() => dispatch(logoutUser())} disabled={saving} full />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = createStyles((c) => ({
  page: { flex: 1, backgroundColor: c.canvas },
  hero: { backgroundColor: '#134127', paddingHorizontal: 20, paddingBottom: 24 },
  heroIcon: { height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroTitle: { marginTop: 14, fontSize: 24, fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  heroSub: { marginTop: 4, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#9dc5af' },
  choices: { gap: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14 },
  choiceOn: { borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  choiceIcon: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.brandSoft },
  choiceIconOn: { backgroundColor: c.card },
  choiceText: { flex: 1, fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  error: { marginTop: 10, fontSize: 12, fontFamily: 'Inter_700Bold', color: '#dc2626' },
}))
