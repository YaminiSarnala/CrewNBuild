// Port of the web src/pages/site/EstimateCalculator.jsx.
// Wired to POST /estimates/calculate — the one public endpoint that needs no auth.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Calculator } from 'lucide-react-native'
import { Field, ErrorBanner } from '../components/Field'
import { PrimaryButton, Eyebrow } from '../components/ui'
import { useLanguage } from '../i18n/LanguageContext'
import { calculatePublicEstimate } from '../api/estimates'
import { SHADOW, TYPE } from '../theme/tokens'
import { createStyles } from '../theme/createStyles'

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
      <View style={[styles.view, { gap: 4 }]}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.pressable, active ? styles.pressable2 : null, active ? SHADOW.card : undefined]}
            >
              <Text
                style={[active ? styles.text : styles.text2, { fontSize: 13 }]}
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
    <View style={styles.view2}>
      <View style={[styles.view3, { paddingTop: insets.top }]}>
        <View style={[styles.view4, { gap: 10 }]}>
          <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back" style={styles.pressable3}>
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
          <Text style={[styles.text3, { fontSize: 18, letterSpacing: -0.4 }]}>
            {t('site.estimate.title')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, width: '100%', maxWidth: 640, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <Eyebrow>{t('site.estimate.badge')}</Eyebrow>
          <Text style={[styles.text4, { fontSize: 14, lineHeight: 21 }]}>
            {t('site.estimate.sub')}
          </Text>

          <View style={[styles.view5, SHADOW.card]}>
            <ErrorBanner message={error} />

            <Field
              label={t('site.estimate.area')}
              value={area}
              onChangeText={setArea}
              placeholder={t('site.estimate.areaPh')}
              keyboardType="numeric"
            />
            <Text style={[styles.text5, { fontSize: 12 }]}>
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

            <Text style={[styles.text6, { fontSize: 13 }]}>
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

            <Text style={[styles.text6, { fontSize: 13 }]}>
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
            <View style={[styles.view6, SHADOW.float]}>
              <Eyebrow dark>{t('site.estimate.result.badge')}</Eyebrow>
              <Text style={[styles.text7, { fontSize: 13 }]}>
                {t('site.estimate.result.approx')}
              </Text>
              <Text style={[styles.text8, { fontSize: 32, letterSpacing: -1.2 }]}>
                ₹{Number(result.total_cost || result.total || 0).toLocaleString('en-IN')}
              </Text>
              {result.min_cost && result.max_cost ? (
                <Text style={[styles.text9, { fontSize: 13 }]}>
                  {t('site.estimate.result.range')}: ₹{Number(result.min_cost).toLocaleString('en-IN')} – ₹
                  {Number(result.max_cost).toLocaleString('en-IN')}
                </Text>
              ) : null}

              <View style={[styles.view7, { gap: 10 }]}>
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
                    <View key={key} style={styles.view8}>
                      <Text style={[styles.text10, { fontSize: 13 }]}>
                        {t(key)}
                      </Text>
                      <Text style={[styles.text11, { fontSize: 13 }]}>
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

const styles = createStyles((c) => ({
  view: { marginBottom: 14, flexDirection: 'row', borderRadius: 14, backgroundColor: c.muted, padding: 3.5 },
  pressable: { flex: 1, alignItems: 'center', borderRadius: 10.5, paddingVertical: 8.75 },
  pressable2: { backgroundColor: c.card },
  text: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  text2: { fontFamily: 'Inter_500Medium', color: c.textMuted },
  view2: { flex: 1, backgroundColor: c.paper },
  view3: { backgroundColor: '#134127', paddingBottom: 14 },
  view4: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 7 },
  pressable3: { padding: 7 },
  text3: { flex: 1, fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  text4: { marginTop: 10.5, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  view5: { marginTop: 21, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 17.5 },
  text5: { marginTop: -7, marginBottom: 10.5, fontFamily: 'Inter_400Regular', color: c.textFaint },
  text6: { marginBottom: 5.25, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  view6: { marginTop: 17.5, borderRadius: 21, backgroundColor: '#134127', padding: 21 },
  text7: { marginTop: 10.5, fontFamily: 'Inter_500Medium', color: '#c3dccd' },
  text8: { marginTop: 3.5, fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  text9: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: '#9dc5af' },
  view7: { marginTop: 17.5 },
  view8: { flexDirection: 'row', justifyContent: 'space-between' },
  text10: { fontFamily: 'Inter_400Regular', color: '#c3dccd' },
  text11: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
}))
