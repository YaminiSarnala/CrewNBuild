// Native Book Technician: exchange the Octabuild session for a Partner booking
// session, pick a trade, describe the job, book at the phone's location, and
// track/cancel bookings. Only OWNER and ENGINEER may book — same rule as web.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Alert, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import * as Location from 'expo-location'
import { ArrowLeft, Paintbrush, Wrench, Zap, Hammer, MapPin } from 'lucide-react-native'
import { Panel, PanelState } from '../../components/DashboardShell'
import { startRequesterSession, clearRequesterSession, createBooking, fetchMyBookings, cancelBooking } from '../../api/partner'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const TRADES = [
  { code: 'PLUMBER', label: 'Plumber', icon: Wrench },
  { code: 'ELECTRICIAN', label: 'Electrician', icon: Zap },
  { code: 'PAINTER', label: 'Painter', icon: Paintbrush },
  { code: 'CARPENTER', label: 'Carpenter', icon: Hammer },
]

export default function BookTechnicianScreen({ navigation, route }) {
  const insets = useSafeAreaInsets()
  const accessToken = useSelector((state) => state.auth.accessToken)
  const [phase, setPhase] = useState('connecting') // connecting | ready | error
  const [error, setError] = useState('')
  // Home's trade cards open this screen with that trade already picked.
  const [trade, setTrade] = useState(route?.params?.trade || null)
  const [description, setDescription] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookings, setBookings] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  async function loadBookings() {
    try { setBookings(await fetchMyBookings()) } catch { setBookings([]) }
  }

  useEffect(() => {
    let active = true
    startRequesterSession(accessToken)
      .then(async () => { if (active) { setPhase('ready'); await loadBookings() } })
      .catch((err) => {
        if (!active) return
        setError(err?.response?.data?.detail || 'Could not connect to the booking service. Is the Partner backend reachable?')
        setPhase('error')
      })
    return () => { active = false; clearRequesterSession() }
  }, [accessToken])

  async function book() {
    if (!trade) { Alert.alert('Pick a trade', 'Choose which technician you need.'); return }
    setBooking(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Location needed', 'The nearest technicians are found from where you are — allow location to book.')
        return
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      await createBooking({
        technicianType: trade,
        description: description.trim(),
        serviceLatitude: position.coords.latitude,
        serviceLongitude: position.coords.longitude,
        serviceAccuracy: position.coords.accuracy,
      })
      setTrade(null)
      setDescription('')
      Alert.alert('Booking placed', 'Nearby technicians are being asked. Track it below.')
      await loadBookings()
    } catch (err) {
      Alert.alert('Could not book', err?.response?.data?.detail || 'Please try again.')
    } finally {
      setBooking(false)
    }
  }

  async function cancel(bookingRow) {
    setCancellingId(bookingRow.id)
    try { await cancelBooking(bookingRow.id); await loadBookings() }
    catch (err) { Alert.alert('Could not cancel', err?.response?.data?.detail || 'Please try again.') }
    finally { setCancellingId(null) }
  }

  const bookingList = Array.isArray(bookings) ? bookings : []
  const cancellable = (status) => ['PENDING', 'SEARCHING', 'OFFERED', 'ASSIGNED'].includes(String(status || '').toUpperCase())

  return (
    <View style={[styles.view, { paddingTop: insets.top }]}>
      <View style={styles.view2}>
        <Pressable onPress={() => navigation.goBack()}><ArrowLeft size={20} color={COLORS.graphite} /></Pressable>
        <Text style={styles.text}>Book a technician</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {phase === 'connecting' && <Text style={styles.text2}>Connecting to the booking service…</Text>}
        {phase === 'error' && (
          <View style={styles.view3}>
            <Text style={styles.text3}>{error}</Text>
          </View>
        )}
        {phase === 'ready' && (
          <>
            <Panel title="What do you need?">
              <View style={styles.view4}>
                {TRADES.map(({ code, label, icon: Icon }) => {
                  const active = trade === code
                  return (
                    <Pressable key={code} onPress={() => setTrade(code)} style={[styles.pressable, active ? styles.pressable2 : styles.pressable3]}>
                      <Icon size={22} color={active ? '#fff' : COLORS.brand[700]} />
                      <Text style={[styles.text4, active ? styles.text5 : styles.text6]}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the job (e.g. Kitchen tap leaking)"
                multiline
                style={styles.textInput}
                placeholderTextColor={COLORS.slate[400]}
              />
              <View style={styles.view5}>
                <MapPin size={12} color={COLORS.slate[400]} />
                <Text style={styles.text7}>Technicians nearest to your current location will be asked.</Text>
              </View>
              <Pressable onPress={book} disabled={booking} style={[styles.pressable4, booking ? styles.pressable5 : null]}>
                <Text style={styles.text8}>{booking ? 'Booking…' : 'Book now'}</Text>
              </Pressable>
            </Panel>

            <Panel title="My bookings">
              <PanelState loading={bookings === null} empty={!bookingList.length} emptyText="No bookings yet.">
                {bookingList.map((row) => (
                  <View key={row.id} style={styles.view6}>
                    <View style={styles.view7}>
                      <Text style={styles.text9} numberOfLines={1}>
                        {row.technician_type || 'Technician'}{row.technician_name ? ` · ${row.technician_name}` : ''}
                      </Text>
                      <Text style={styles.text10}>{row.status || 'PENDING'}</Text>
                    </View>
                    {!!row.description && <Text style={styles.text11} numberOfLines={1}>{row.description}</Text>}
                    {cancellable(row.status) && (
                      <Pressable onPress={() => cancel(row)} disabled={cancellingId === row.id} style={styles.pressable6}>
                        <Text style={styles.text12}>Cancel booking</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </PanelState>
            </Panel>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: c.brandSoft },
  view2: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10.5 },
  text: { fontSize: 15.75, lineHeight: 24.5, fontWeight: '800', color: c.text },
  text2: { fontSize: 12.25, lineHeight: 17.5, fontWeight: '600', color: c.textMuted },
  view3: { borderRadius: 10.5, borderWidth: 1, borderColor: c.roseBorderSoft, backgroundColor: c.roseSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  text3: { fontSize: 13, fontWeight: '600', color: c.roseText },
  view4: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10.5 },
  pressable: { width: '48%', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14 },
  pressable2: { borderColor: '#1a5038', backgroundColor: '#1a5038' },
  pressable3: { borderColor: c.border, backgroundColor: c.card },
  text4: { marginTop: 7, fontSize: 13, fontWeight: '800' },
  text5: { color: '#ffffff' },
  text6: { color: c.text },
  textInput: { marginTop: 10.5, minHeight: 70, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 8.75, fontSize: 14, fontWeight: '600', color: c.text },
  view5: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text7: { fontSize: 11, fontWeight: '600', color: c.textFaint },
  pressable4: { marginTop: 10.5, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable5: { opacity: 0.5 },
  text8: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  view6: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view7: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text9: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  text10: { fontSize: 10, fontWeight: '800', color: c.brandText },
  text11: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  pressable6: { marginTop: 7, alignSelf: 'flex-start', borderRadius: 7, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 8.75, paddingVertical: 5.25 },
  text12: { fontSize: 10, fontWeight: '800', color: c.roseText },
}))
