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
    <View className="flex-1 bg-paper">
      <View
        style={{ paddingTop: insets.top + 18 }}
        className="bg-brand-800 px-5 pb-7"
      >
        <View className="mb-5 h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <MapPin size={25} color="#ffffff" />
        </View>

        <Text className="font-display text-white" style={{ fontSize: 27 }}>
          Set your location
        </Text>

        <Text className="mt-2 font-sans text-brand-200" style={{ fontSize: 14, lineHeight: 21 }}>
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
          <GlassCard className="p-5">
            <Text className="font-sansBold text-graphite" style={{ fontSize: 16 }}>
              Enter your pincode
            </Text>

            <Text className="mt-1 mb-4 font-sans text-slate-500" style={{ fontSize: 13, lineHeight: 19 }}>
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
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-sans text-graphite"
              style={{ fontSize: 16 }}
            />

            <View className="mt-4">
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
              <View className="mt-5 rounded-2xl bg-brand-50 p-4">
                <Text className="font-sansSemi text-brand-800" style={{ fontSize: 13 }}>
                  {[
                    areaDetails.city,
                    areaDetails.district,
                    areaDetails.state,
                  ].filter(Boolean).join(', ')}
                </Text>
                <Text className="mt-1 font-sans text-slate-500" style={{ fontSize: 12 }}>
                  Select your post office or area below.
                </Text>
              </View>
            ) : null}

            {areas.length > 0 ? (
              <View className="mt-5">
                <Text className="mb-3 font-sansBold text-graphite" style={{ fontSize: 14 }}>
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
      className={`mb-2 flex-row items-center justify-between rounded-2xl border p-4 ${
        selected
          ? 'border-brand-600 bg-brand-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <Text
        className={`flex-1 font-sansSemi ${
          selected ? 'text-brand-800' : 'text-graphite'
        }`}
        style={{ fontSize: 14 }}
      >
        {area.name}
      </Text>

      {selected ? (
        <CheckCircle2 size={20} color="#2e7d55" />
      ) : null}
    </Pressable>
  )
})}

                <View className="mt-3">
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
              <Text accessibilityRole="alert" className="mt-4 font-sans text-red-600" style={{ fontSize: 13, lineHeight: 19 }}>
                {error}
              </Text>
            ) : null}

            {lookupLoading ? (
              <ActivityIndicator color="#2e7d55" style={{ marginTop: 18 }} />
            ) : null}
          </GlassCard>

          <View className="mt-5">
            <GhostButton
              label="Later — go to dashboard"
              onPress={continueToDashboard}
              full
            />
          </View>

          <Text className="mt-4 text-center font-sans text-slate-500" style={{ fontSize: 12, lineHeight: 18 }}>
            You can update your location later.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}