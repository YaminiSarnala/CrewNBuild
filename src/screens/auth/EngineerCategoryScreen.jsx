// The engineer's category step (web pages/auth/EngineerCategoryPage.jsx):
// Create Account -> Engineer Category -> Pincode -> Dashboard. Shown by the root
// navigator while a signed-in ENGINEER has no category; Continue saves it
// (PATCH /auth/engineer-category) and the saved account then moves the app on —
// to the pincode step, then the Store Manager or the Engineer dashboard.
import { useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowRight, HardHat, LogOut } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { saveEngineerCategory } from '../../api/auth'
import { logoutUser, mergeUser } from '../../store/authSlice'
import { ENGINEER_CATEGORY_OPTIONS, engineerCategoryLabel } from '../../utils/engineerProfile'
import { ink } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

export default function EngineerCategoryScreen() {
  const { t } = useLanguage()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const user = useSelector((state) => state.auth.user)
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)

  async function submit() {
    if (submitting.current) return
    if (!category) { setError(t('cp.val.specialization')); return }
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await saveEngineerCategory(category)
      // The saved account no longer misses its category, so the navigator moves on.
      dispatch(mergeUser(saved?.user || saved || {}))
      return
    } catch {
      submitting.current = false
      setSaving(false)
      setError(t('engineer.category.saveFailed'))
    }
  }

  return (
    <View style={styles.ec6}>
      <View style={[{ paddingTop: insets.top + 18 }, styles.ec7]}>
        <View style={styles.ec8}>
          <View style={styles.ec9}>
            <HardHat size={25} color="#ffffff" />
          </View>
          <Pressable onPress={() => dispatch(logoutUser())} accessibilityLabel={t('ui.logout')} style={styles.ec10}>
            <LogOut size={18} color="#ffffff" />
          </Pressable>
        </View>
        <Text style={[styles.ec11, { fontSize: 24 }]}>{t('profile.engineerCategorySelect')}</Text>
        {user?.name ? <Text style={[styles.ec12, { fontSize: 14 }]}>{user.name}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 28 }}>
        <View style={styles.ec13}>
          {ENGINEER_CATEGORY_OPTIONS.map((value) => {
            const selected = category === value
            return (
              <Pressable
                key={value}
                onPress={() => { setCategory(value); setError('') }}
                disabled={saving}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.ec1, selected ? styles.ec2 : styles.ec3]}
              >
                <Text style={styles.ec14}>{engineerCategoryLabel(value, t)}</Text>
              </Pressable>
            )
          })}
        </View>

        {error ? <Text style={styles.ec15}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={[styles.ec4, saving ? styles.ec5 : null]}
        >
          <Text style={styles.ec16}>{saving ? t('dash.common.saving') : t('ps.supplierCategoryContinue')}</Text>
          {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <ArrowRight size={16} color="#ffffff" />}
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = createStyles((c) => ({
  ec1: { marginBottom: 8.75, minHeight: 42, width: '48.5%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 8.75 },
  ec2: { borderColor: '#1a5038', backgroundColor: c.brandSoft },
  ec3: { borderColor: c.border, backgroundColor: c.card },
  ec4: { marginTop: 14, height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: '#1a5038' },
  ec5: { opacity: 0.6 },
  ec6: { flex: 1, backgroundColor: c.paper },
  ec7: { backgroundColor: '#134127', paddingHorizontal: 17.5, paddingBottom: 24.5 },
  ec8: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  ec9: { marginBottom: 17.5, height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  ec10: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  ec11: { fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  ec12: { marginTop: 7, color: '#c3dccd' },
  ec13: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  ec14: { textAlign: 'center', fontSize: 13, fontWeight: '800', color: c.brandTextDeep },
  ec15: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: ink('#e11d48') },
    ec16: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: '#ffffff' },
}))