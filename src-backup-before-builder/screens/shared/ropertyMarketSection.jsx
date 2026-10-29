// Property tab of Buy & Sell: browse LISTED properties, search, send an
// enquiry (PROPERTY_BUYER_TO_SELLER), and see your own listings with status.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useSelector } from 'react-redux'
import { MapPin, BedDouble, Send } from 'lucide-react-native'
import { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchPropertyListings, fetchMyPropertyListings, sendPropertyRequest } from '../../api/properties'
import { COLORS } from '../../theme/tokens'

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
        className="mb-3 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
        placeholderTextColor={COLORS.slate[400]}
      />

      {canSell && !!myList.length && (
        <Panel title="My listings">
          {myList.map((listing) => (
            <View key={listing.id} className="flex-row items-center justify-between border-b border-slate-100 py-2.5">
              <Text className="flex-1 text-[13px] font-extrabold text-graphite" numberOfLines={1}>{listing.title}</Text>
              <Text className="ml-2 text-[10px] font-extrabold text-brand-700">{listing.status || 'LISTED'}</Text>
            </View>
          ))}
        </Panel>
      )}

      <PanelState loading={listings.loading} error={listings.error} empty={!filtered.length} emptyText="No properties on the market right now.">
        {filtered.map((listing) => {
          const isMine = String(listing.seller_id) === String(user?.id)
          const sent = sentIds.has(listing.id)
          return (
            <View key={listing.id} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-[15px] font-extrabold text-graphite" numberOfLines={2}>{listing.title}</Text>
                <Text className="text-[15px] font-extrabold text-brand-700">{money(listing.price)}</Text>
              </View>
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <MapPin size={11} color={COLORS.slate[400]} />
                <Text className="flex-1 text-[11px] font-semibold text-slate-400" numberOfLines={1}>
                  {[listing.city, listing.pincode].filter(Boolean).join(' · ') || 'Location on enquiry'}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center gap-3">
                {!!listing.property_type && <Text className="text-[11px] font-bold text-slate-500">{listing.property_type}</Text>}
                {!!listing.bedrooms && (
                  <View className="flex-row items-center gap-1">
                    <BedDouble size={11} color={COLORS.slate[400]} />
                    <Text className="text-[11px] font-bold text-slate-500">{listing.bedrooms} BHK</Text>
                  </View>
                )}
                {!!listing.built_up_area && <Text className="text-[11px] font-bold text-slate-500">{listing.built_up_area} sq.ft</Text>}
              </View>
              {!isMine && (
                <Pressable
                  onPress={() => enquire(listing)}
                  disabled={sent || sendingId === listing.id}
                  className={`mt-3 h-10 flex-row items-center justify-center gap-1.5 rounded-full ${sent ? 'bg-brand-50' : 'bg-brand-700'} ${sendingId === listing.id ? 'opacity-60' : ''}`}
                >
                  <Send size={13} color={sent ? COLORS.brand[700] : '#fff'} />
                  <Text className={`text-xs font-extrabold ${sent ? 'text-brand-700' : 'text-white'}`}>
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