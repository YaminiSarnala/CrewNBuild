import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapPin, Search, ArrowRight, CheckCircle2 } from 'lucide-react-native'
import { lookupPincodeArea, updateUserLocation } from '../../api/location'
import { mergeUser } from '../../store/authSlice'
import { PrimaryButton, GhostButton, GlassCard } from '../../components/ui'
import { createStyles } from '../../theme/createStyles'

export default function PincodeSetupScreen({ navigation }) {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const user = useSelector((state) => state.auth.user)

  const [pincode, setPincode] = useState(String(user?.pincode || ''))
  const [areas, setAreas] = useState([])
  const [selectedArea, setSelectedArea] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [areaDetails, setAreaDetails] = useState(null)

  async function findAreas() {
    const value = pincode.trim()

    if (!/^\d{6}$/.test(value)) {
      setError('Enter a valid 6-digit pincode.')
      return
    }

    setLookupLoading(true)
    setError('')
    setAreas([])
    setSelectedArea('')
    setAreaDetails(null)

    try {
const data = await lookupPincodeArea(value)

const branches = Array.isArray(data?.post_offices)
  ? data.post_offices
  : []

setAreaDetails(data)
setAreas(branches)

if (branches.length === 1) {
  setSelectedArea(branches[0].name)
} else if (branches.length === 0) {
  setError('No areas found for this pincode. Please try again.')
}
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          'Could not find this pincode. Please check your connection and try again.',
      )
    } finally {
      setLookupLoading(false)
    }
  }

  async function saveLocation() {
    if (!areaDetails || !selectedArea) {
      setError('Please look up your pincode and select an area.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const updatedUser = await updateUserLocation(
        String(areaDetails.pincode || pincode).trim(),
        selectedArea,
      )

      dispatch(mergeUser(updatedUser?.user || updatedUser))
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          'Could not save your location. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }
function continueToDashboard() {
  const role = user?.role

  const dashboardRoutes = {
    OWNER: 'OwnerHome',
    CONTRACTOR: 'ContractorHome',
    SUPPLIER: 'SupplierHome',
    ENGINEER: 'EngineerHome',
  }

  const routeName = dashboardRoutes[role] || 'OwnerHome'

  navigation.replace(routeName)
}
  return (
    <View style={styles.view}>
      <View
        style={[styles.view2, { paddingTop: insets.top + 18 }]}
      >
        <View style={styles.view3}>
          <MapPin size={25} color="#ffffff" />
        </View>

        <Text style={[styles.text, { fontSize: 27 }]}>
          Set your location
        </Text>

        <Text style={[styles.text2, { fontSize: 14, lineHeight: 21 }]}>
          Find construction services and professionals available in your area.
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 28,
          }}
        >
          <GlassCard style={styles.glassCard}>
            <Text style={[styles.text3, { fontSize: 16 }]}>
              Enter your pincode
            </Text>

            <Text style={[styles.text4, { fontSize: 13, lineHeight: 19 }]}>
              We'll use this to find the correct service area.
            </Text>

            <TextInput
              value={pincode}
              onChangeText={(value) => {
                setPincode(value.replace(/\D/g, '').slice(0, 6))
                setAreas([])
                setSelectedArea('')
                setAreaDetails(null)
                setError('')
              }}
              placeholder="6-digit pincode"
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel="6-digit pincode"
              style={[styles.textInput, { fontSize: 16 }]}
            />

            <View style={styles.view4}>
              <PrimaryButton
                label="Find my area"
                icon={<Search size={17} color="#ffffff" />}
                onPress={findAreas}
                loading={lookupLoading}
                disabled={lookupLoading || pincode.length !== 6}
                full
              />
            </View>

            {areaDetails ? (
              <View style={styles.view5}>
                <Text style={[styles.text5, { fontSize: 13 }]}>
                  {[
                    areaDetails.city,
                    areaDetails.district,
                    areaDetails.state,
                  ].filter(Boolean).join(', ')}
                </Text>
                <Text style={[styles.text6, { fontSize: 12 }]}>
                  Select your post office or area below.
                </Text>
              </View>
            ) : null}

            {areas.length > 0 ? (
              <View style={styles.view6}>
                <Text style={[styles.text7, { fontSize: 14 }]}>
                  Available areas
                </Text>
{areas.map((area) => {
  const selected = selectedArea === area.name

  return (
    <Pressable
      key={area.name}
      onPress={() => setSelectedArea(area.name)}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.pressable, selected ? styles.pressable2 : styles.pressable3]}
    >
      <Text
        style={[styles.text8, selected ? styles.text9 : styles.text10, { fontSize: 14 }]}
      >
        {area.name}
      </Text>

      {selected ? (
        <CheckCircle2 size={20} color="#2e7d55" />
      ) : null}
    </Pressable>
  )
})}

                <View style={styles.view7}>
                  <PrimaryButton
                    label="Save location"
                    icon={<ArrowRight size={17} color="#ffffff" />}
                    onPress={saveLocation}
                    loading={saving}
                    disabled={saving || !selectedArea}
                    full
                  />
                </View>
              </View>
            ) : null}

            {error ? (
              <Text accessibilityRole="alert" style={[styles.text11, { fontSize: 13, lineHeight: 19 }]}>
                {error}
              </Text>
            ) : null}

            {lookupLoading ? (
              <ActivityIndicator color="#2e7d55" style={{ marginTop: 18 }} />
            ) : null}
          </GlassCard>

          <View style={styles.view6}>
            <GhostButton
              label="Later — go to dashboard"
              onPress={continueToDashboard}
              full
            />
          </View>

          <Text style={[styles.text12, { fontSize: 12, lineHeight: 18 }]}>
            You can update your location later.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: c.paper },
  view2: { backgroundColor: '#134127', paddingHorizontal: 17.5, paddingBottom: 24.5 },
  view3: { marginBottom: 17.5, height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  text: { fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  text2: { marginTop: 7, fontFamily: 'Inter_400Regular', color: '#c3dccd' },
  glassCard: { padding: 17.5 },
  text3: { fontFamily: 'Inter_700Bold', color: c.text },
  text4: { marginTop: 3.5, marginBottom: 14, fontFamily: 'Inter_400Regular', color: c.textMuted },
  textInput: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 14, fontFamily: 'Inter_400Regular', color: c.text },
  view4: { marginTop: 14 },
  view5: { marginTop: 17.5, borderRadius: 16, backgroundColor: c.brandSoft, padding: 14 },
  text5: { fontFamily: 'Inter_600SemiBold', color: c.brandTextStrong },
  text6: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view6: { marginTop: 17.5 },
  text7: { marginBottom: 10.5, fontFamily: 'Inter_700Bold', color: c.text },
  pressable: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, padding: 14 },
  pressable2: { borderColor: '#236645', backgroundColor: c.brandSoft },
  pressable3: { borderColor: c.border, backgroundColor: c.card },
  text8: { flex: 1, fontFamily: 'Inter_600SemiBold' },
  text9: { color: c.brandTextStrong },
  text10: { color: c.text },
  view7: { marginTop: 10.5 },
  text11: { marginTop: 14, fontFamily: 'Inter_400Regular', color: c.redTextSoft },
  text12: { marginTop: 14, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
}))
