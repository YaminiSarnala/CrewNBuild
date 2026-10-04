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

const TRADES = [
  { code: 'PLUMBER', label: 'Plumber', icon: Wrench },
  { code: 'ELECTRICIAN', label: 'Electrician', icon: Zap },
  { code: 'PAINTER', label: 'Painter', icon: Paintbrush },
  { code: 'CARPENTER', label: 'Carpenter', icon: Hammer },
]

export default function BookTechnicianScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const accessToken = useSelector((state) => state.auth.accessToken)
  const [phase, setPhase] = useState('connecting') // connecting | ready | error
  const [error, setError] = useState('')
  const [trade, setTrade] = useState(null)
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
    <View className="flex-1 bg-brand-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Pressable onPress={() => navigation.goBack()}><ArrowLeft size={20} color={COLORS.graphite} /></Pressable>
        <Text className="text-lg font-extrabold text-graphite">Book a technician</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {phase === 'connecting' && <Text className="text-sm font-semibold text-slate-500">Connecting to the booking service…</Text>}
        {phase === 'error' && (
          <View className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
            <Text className="text-[13px] font-semibold text-rose-700">{error}</Text>
          </View>
        )}
        {phase === 'ready' && (
          <>
            <Panel title="What do you need?">
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {TRADES.map(({ code, label, icon: Icon }) => {
                  const active = trade === code
                  return (
                    <Pressable key={code} onPress={() => setTrade(code)} className={`w-[48%] items-center rounded-2xl border p-4 ${active ? 'border-brand-700 bg-brand-700' : 'border-slate-200 bg-white'}`}>
                      <Icon size={22} color={active ? '#fff' : COLORS.brand[700]} />
                      <Text className={`mt-2 text-[13px] font-extrabold ${active ? 'text-white' : 'text-graphite'}`}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the job (e.g. Kitchen tap leaking)"
                multiline
                className="mt-3 min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-semibold text-graphite"
                placeholderTextColor={COLORS.slate[400]}
              />
              <View className="mt-2 flex-row items-center gap-1.5">
                <MapPin size={12} color={COLORS.slate[400]} />
                <Text className="text-[11px] font-semibold text-slate-400">Technicians nearest to your current location will be asked.</Text>
              </View>
              <Pressable onPress={book} disabled={booking} className={`mt-3 h-12 items-center justify-center rounded-xl bg-brand-700 ${booking ? 'opacity-50' : ''}`}>
                <Text className="text-[14px] font-extrabold text-white">{booking ? 'Booking…' : 'Book now'}</Text>
              </Pressable>
            </Panel>

            <Panel title="My bookings">
              <PanelState loading={bookings === null} empty={!bookingList.length} emptyText="No bookings yet.">
                {bookingList.map((row) => (
                  <View key={row.id} className="border-b border-slate-100 py-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>
                        {row.technician_type || 'Technician'}{row.technician_name ? ` · ${row.technician_name}` : ''}
                      </Text>
                      <Text className="text-[10px] font-extrabold text-brand-700">{row.status || 'PENDING'}</Text>
                    </View>
                    {!!row.description && <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{row.description}</Text>}
                    {cancellable(row.status) && (
                      <Pressable onPress={() => cancel(row)} disabled={cancellingId === row.id} className="mt-2 self-start rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5">
                        <Text className="text-[10px] font-extrabold text-rose-700">Cancel booking</Text>
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