// Port of the web src/pages/site/EstimateCalculator.jsx.
// Wired to POST /estimates/calculate — the one public endpoint that needs no auth.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Calculator } from 'lucide-react-native'
import { Field, ErrorBanner } from '../components/Field'
import { PrimaryButton, Eyebrow } from '../components/ui'
import { useLanguage } from '../i18n/LanguageContext'
import { calculatePublicEstimate } from '../api/estimates'
import { SHADOW, TYPE } from '../theme/tokens'

export default function EstimateScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()

  const [area, setArea] = useState('')
  const [floors, setFloors] = useState('1')
  const [pincode, setPincode] = useState('')
  const [location, setLocation] = useState('')
  const [buildingType, setBuildingType] = useState('RESIDENTIAL')
  const [finishing, setFinishing] = useState('STANDARD')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function calculate() {
    const areaValue = Number(area)
    if (!areaValue || areaValue <= 0) return setError(t('site.estimate.errArea'))
    const floorValue = Number(floors)
    if (!floorValue || floorValue <= 0) return setError(t('site.estimate.errFloor'))

    try {
      setLoading(true)
      setError('')
      const payload = {
        land_area: areaValue,
        floors: floorValue,
        pincode,
        location,
        building_type: buildingType,
        finishing_level: finishing,
      }
      setResult(await calculatePublicEstimate(payload))
    } catch (err) {
      setError(err?.response?.data?.detail || t('site.estimate.errCalc'))
    } finally {
      setLoading(false)
    }
  }

  function Choice({ options, value, onChange }) {
    return (
      <View className="mb-4 flex-row rounded-2xl bg-slate-100 p-1" style={{ gap: 4 }}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              className={`flex-1 items-center rounded-xl py-2.5 ${active ? 'bg-white' : ''}`}
              style={active ? SHADOW.card : undefined}
            >
              <Text
                className={active ? 'font-sansBold text-brand-800' : 'font-sansMedium text-slate-500'}
                style={{ fontSize: 13 }}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper">
      <View style={{ paddingTop: insets.top }} className="bg-brand-800 pb-4">
        <View className="flex-row items-center px-4 pt-2" style={{ gap: 10 }}>
          <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back" className="p-2">
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
          <Text className="flex-1 font-display text-white" style={{ fontSize: 18, letterSpacing: -0.4 }}>
            {t('site.estimate.title')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, width: '100%', maxWidth: 640, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <Eyebrow>{t('site.estimate.badge')}</Eyebrow>
          <Text className="mt-3 font-sans text-slate-600" style={{ fontSize: 14, lineHeight: 21 }}>
            {t('site.estimate.sub')}
          </Text>

          <View className="mt-6 rounded-3xl border border-slate-200 bg-white p-5" style={SHADOW.card}>
            <ErrorBanner message={error} />

            <Field
              label={t('site.estimate.area')}
              value={area}
              onChangeText={setArea}
              placeholder={t('site.estimate.areaPh')}
              keyboardType="numeric"
            />
            <Text className="-mt-2 mb-3 font-sans text-slate-400" style={{ fontSize: 12 }}>
              {t('site.estimate.areaHint')}
            </Text>

            <Field
              label={t('site.estimate.floors')}
              value={floors}
              onChangeText={setFloors}
              placeholder="1"
              keyboardType="numeric"
            />
            <Field
              label={t('site.estimate.location')}
              value={location}
              onChangeText={setLocation}
              placeholder={t('site.estimate.locationPh')}
            />
            <Field
              label={t('site.estimate.pincode')}
              value={pincode}
              onChangeText={setPincode}
              placeholder={t('site.estimate.pincodePh')}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Text className="mb-1.5 font-sansSemi text-slate-600" style={{ fontSize: 13 }}>
              {t('site.estimate.buildingType')}
            </Text>
            <Choice
              value={buildingType}
              onChange={setBuildingType}
              options={[
                { value: 'RESIDENTIAL', label: t('site.estimate.buildingRes') },
                { value: 'COMMERCIAL', label: t('site.estimate.buildingComm') },
              ]}
            />

            <Text className="mb-1.5 font-sansSemi text-slate-600" style={{ fontSize: 13 }}>
              {t('site.estimate.finishing')}
            </Text>
            <Choice
              value={finishing}
              onChange={setFinishing}
              options={[
                { value: 'STANDARD', label: t('site.estimate.finStd') },
                { value: 'PREMIUM', label: t('site.estimate.finPrem') },
              ]}
            />

            <PrimaryButton
              label={loading ? t('site.estimate.calculating') : t('site.estimate.calc')}
              onPress={calculate}
              loading={loading}
              icon={<Calculator size={16} color="#ffffff" />}
              full
            />
          </View>

          {result ? (
            <View className="mt-5 rounded-3xl bg-brand-800 p-6" style={SHADOW.float}>
              <Eyebrow dark>{t('site.estimate.result.badge')}</Eyebrow>
              <Text className="mt-3 font-sansMedium text-brand-200" style={{ fontSize: 13 }}>
                {t('site.estimate.result.approx')}
              </Text>
              <Text className="mt-1 font-display text-white" style={{ fontSize: 32, letterSpacing: -1.2 }}>
                ₹{Number(result.total_cost || result.total || 0).toLocaleString('en-IN')}
              </Text>
              {result.min_cost && result.max_cost ? (
                <Text className="mt-1 font-sans text-brand-300" style={{ fontSize: 13 }}>
                  {t('site.estimate.result.range')}: ₹{Number(result.min_cost).toLocaleString('en-IN')} – ₹
                  {Number(result.max_cost).toLocaleString('en-IN')}
                </Text>
              ) : null}

              <View className="mt-5" style={{ gap: 10 }}>
                {[
                  ['site.estimate.result.builtUp', result.built_up_area],
                  ['site.estimate.result.rateUsed', result.rate_used],
                  ['site.estimate.result.materials', result.materials_cost],
                  ['site.estimate.result.labour', result.labour_cost],
                  ['site.estimate.result.other', result.other_cost],
                  ['site.estimate.result.contingency', result.contingency],
                ]
                  .filter(([, value]) => value !== undefined && value !== null)
                  .map(([key, value]) => (
                    <View key={key} className="flex-row justify-between">
                      <Text className="font-sans text-brand-200" style={{ fontSize: 13 }}>
                        {t(key)}
                      </Text>
                      <Text className="font-sansBold text-white" style={{ fontSize: 13 }}>
                        {typeof value === 'number' ? value.toLocaleString('en-IN') : String(value)}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
