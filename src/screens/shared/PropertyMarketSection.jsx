// Property tab of Buy & Sell: browse LISTED properties, search, send an
// enquiry (PROPERTY_BUYER_TO_SELLER), and see your own listings with status.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useSelector } from 'react-redux'
import { MapPin, BedDouble, Send } from 'lucide-react-native'
import { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchPropertyListings, fetchMyPropertyListings, sendPropertyRequest } from '../../api/properties'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const money = (value) => (Number(value || 0) ? `₹${Number(value).toLocaleString('en-IN')}` : 'Price on request')

export default function PropertyMarketSection() {
  const user = useSelector((state) => state.auth.user)
  const [search, setSearch] = useState('')
  const [sentIds, setSentIds] = useState(new Set())
  const [sendingId, setSendingId] = useState(null)

  const listings = useAsyncData(() => fetchPropertyListings({}), [])
  const canSell = user?.role === 'OWNER' || user?.role === 'CONTRACTOR'
  const mine = useAsyncData(() => (canSell ? fetchMyPropertyListings().catch(() => []) : Promise.resolve([])), [canSell])

  const listingList = Array.isArray(listings.data) ? listings.data : (listings.data?.listings || [])
  const myList = Array.isArray(mine.data) ? mine.data : []
  const filtered = search.trim()
    ? listingList.filter((l) => `${l.title} ${l.city} ${l.pincode} ${l.property_type}`.toLowerCase().includes(search.trim().toLowerCase()))
    : listingList

  function enquire(listing) {
    Alert.alert('Send enquiry', `Ask the seller about "${listing.title}"? They'll see your interest and can share contact details.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send enquiry',
        onPress: async () => {
          setSendingId(listing.id)
          try {
            await sendPropertyRequest(listing.id, null)
            setSentIds((prev) => new Set(prev).add(listing.id))
          } catch (error) {
            Alert.alert('Could not send', error?.response?.data?.detail || 'Please try again.')
          } finally {
            setSendingId(null)
          }
        },
      },
    ])
  }

  return (
    <View>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by title, city, pincode…"
        style={styles.textInput}
        placeholderTextColor={COLORS.slate[400]}
      />

      {canSell && !!myList.length && (
        <Panel title="My listings">
          {myList.map((listing) => (
            <View key={listing.id} style={styles.view}>
              <Text style={styles.text} numberOfLines={1}>{listing.title}</Text>
              <Text style={styles.text2}>{listing.status || 'LISTED'}</Text>
            </View>
          ))}
        </Panel>
      )}

      <PanelState loading={listings.loading} error={listings.error} empty={!filtered.length} emptyText="No properties on the market right now.">
        {filtered.map((listing) => {
          const isMine = String(listing.seller_id) === String(user?.id)
          const sent = sentIds.has(listing.id)
          return (
            <View key={listing.id} style={styles.view2}>
              <View style={styles.view3}>
                <Text style={styles.text3} numberOfLines={2}>{listing.title}</Text>
                <Text style={styles.text4}>{money(listing.price)}</Text>
              </View>
              <View style={styles.view4}>
                <MapPin size={11} color={COLORS.slate[400]} />
                <Text style={styles.text5} numberOfLines={1}>
                  {[listing.city, listing.pincode].filter(Boolean).join(' · ') || 'Location on enquiry'}
                </Text>
              </View>
              <View style={styles.view5}>
                {!!listing.property_type && <Text style={styles.text6}>{listing.property_type}</Text>}
                {!!listing.bedrooms && (
                  <View style={styles.view6}>
                    <BedDouble size={11} color={COLORS.slate[400]} />
                    <Text style={styles.text6}>{listing.bedrooms} BHK</Text>
                  </View>
                )}
                {!!listing.built_up_area && <Text style={styles.text6}>{listing.built_up_area} sq.ft</Text>}
              </View>
              {!isMine && (
                <Pressable
                  onPress={() => enquire(listing)}
                  disabled={sent || sendingId === listing.id}
                  style={[styles.pressable, sent ? styles.pressable2 : styles.pressable3, sendingId === listing.id ? styles.pressable4 : null]}
                >
                  <Send size={13} color={sent ? COLORS.brand[700] : '#fff'} />
                  <Text style={[styles.text7, sent ? styles.text8 : styles.text9]}>
                    {sent ? 'Enquiry sent' : 'Enquire'}
                  </Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </PanelState>
    </View>
  )
}

const styles = createStyles((c) => ({
  textInput: { marginBottom: 10.5, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  view: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  text: { flex: 1, fontSize: 13, fontWeight: '800', color: c.text },
  text2: { marginLeft: 7, fontSize: 10, fontWeight: '800', color: c.brandText },
  view2: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view3: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 7 },
  text3: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text },
  text4: { fontSize: 15, fontWeight: '800', color: c.brandText },
  view4: { marginTop: 5.25, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text5: { flex: 1, fontSize: 11, fontWeight: '600', color: c.textFaint },
  view5: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  text6: { fontSize: 11, fontWeight: '700', color: c.textMuted },
  view6: { flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  pressable: { marginTop: 10.5, height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 9999 },
  pressable2: { backgroundColor: c.brandSoft },
  pressable3: { backgroundColor: '#1a5038' },
  pressable4: { opacity: 0.6 },
  text7: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  text8: { color: c.brandText },
  text9: { color: '#ffffff' },
}))
