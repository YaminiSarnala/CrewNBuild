// Property Buy & Sell -- port of web components/property/PropertyBuySellHub.jsx
// (+ SellListingCard, PropertyDetailPanel). ONE component for the House Owner
// and the Builder: the same published feed, the same listings table, the same
// endpoints (api/properties). The caller only picks which tab opens first.
//
//   Buy   search (as you type) + type / city / BHK filters, listing cards, and
//         the detail sheet where a buyer sends the seller an enquiry with an
//         optional offer (a project request; needs a complete profile).
//   Sell  the signed-in seller's own listings. Add Property opens the form;
//         opening a listing shows Edit, the status moves and Delete.
//
// Seller contact is shown only when the server says so (can_view_contact).
// Every photo is loaded with the sign-in header (imageSource): /files/ answers
// "Authentication required" otherwise.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import {
  Bath, BedDouble, Building2, CalendarClock, Camera, Compass, Eye, Home, Layers, MapPin, Maximize2, Pencil, Plus, Search,
  Send, SlidersHorizontal, Sofa, Store, Trash2,
} from 'lucide-react-native'
import {
  deletePropertyListing, fetchMyPropertyListings, fetchPropertyListing, fetchPropertyListings, sendPropertyRequest,
  updatePropertyListingStatus,
} from '../../api/properties'
import { imageSource } from '../../api/client'
import { ActionButton, LabeledInput, SearchBox, SegmentTabs, SelectChip, SheetModal } from '../builder/BuilderUi'
import { ListingForm, saveListingWithGallery } from '../builder/PropertySellSection'
import { BudgetInWords } from '../form'
import { ImageViewer } from '../StoredFile'
import { toast } from '../Toast'
import { useLanguage } from '../../i18n/LanguageContext'
import { useProfileGate } from '../../hooks/useProfileGate'
import { avatarFromPath } from '../../utils/avatars'
import { formatMoney } from '../../utils/countryConfig'
import { formatNumber } from '../../utils/formatters'
import { apiErrorText } from '../../utils/builderHelpers'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

// Which lifecycle moves are offered per status (the server owns the rule).
const STATUS_ACTIONS = {
  DRAFT: [{ status: 'LISTED', labelKey: 'property.action.publish', primary: true }],
  LISTED: [
    { status: 'UNDER_OFFER', labelKey: 'property.action.markUnderOffer' },
    { status: 'SOLD', labelKey: 'property.action.markSold' },
    { status: 'WITHDRAWN', labelKey: 'property.action.withdraw' },
  ],
  UNDER_OFFER: [
    { status: 'SOLD', labelKey: 'property.action.markSold' },
    { status: 'LISTED', labelKey: 'property.action.relist' },
    { status: 'WITHDRAWN', labelKey: 'property.action.withdraw' },
  ],
  WITHDRAWN: [{ status: 'LISTED', labelKey: 'property.action.relist', primary: true }],
  SOLD: [],
}
const STATUS_LABEL_KEYS = {
  DRAFT: 'ui.shared.statusDraft', LISTED: 'ui.shared.statusListed', UNDER_OFFER: 'ui.shared.statusUnderOffer',
  SOLD: 'ui.shared.statusSold', WITHDRAWN: 'ui.shared.statusWithdrawn',
}
const STATUS_TONES = { DRAFT: '#334155', UNDER_OFFER: '#f59e0b', SOLD: '#0284c7', WITHDRAWN: '#e11d48', LISTED: '#059669' }
const FACING_KEYS = {
  EAST: 'ui.owner.facingEast', WEST: 'ui.owner.facingWest', NORTH: 'ui.owner.facingNorth', SOUTH: 'ui.owner.facingSouth',
  NORTH_EAST: 'ui.owner.facingNorthEast', NORTH_WEST: 'ui.owner.facingNorthWest', SOUTH_EAST: 'ui.owner.facingSouthEast', SOUTH_WEST: 'ui.owner.facingSouthWest',
}
const SELLER_ROLE_KEYS = { OWNER: 'role.owner', CONTRACTOR: 'role.contractor', SUPPLIER: 'role.supplier', ENGINEER: 'role.engineer' }

// ---------------------------------------------------------------- labels (web PropertyCard helpers)

const readableCode = (value) => String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())
function codeLabel(t, prefix, value, td) {
  if (!value) return ''
  const key = `${prefix}.${value}`
  const label = t(key)
  return label !== key ? label : td(readableCode(value))
}
const facingLabel = (t, value, td) => (!value ? '' : FACING_KEYS[value] ? t(FACING_KEYS[value]) : td(readableCode(value)))
const listingBedrooms = (listing) => (listing?.property_type === 'PLOT' ? 0 : Number(listing?.bedrooms || 0))
const bhkLabel = (listing, t) => (listingBedrooms(listing) > 0 ? t('ui.owner.bhk', { count: listingBedrooms(listing) }) : '')
function areaLabel(listing, t) {
  const value = [listing?.built_up_area, listing?.carpet_area, listing?.land_area].map(Number).find((n) => n > 0)
  return value ? `${formatNumber(value)} ${t('property.sqft')}` : ''
}
const coverOf = (listing) => listing?.cover_image_url || listing?.images?.[0]?.image_url || ''
function galleryOf(listing) {
  return [listing?.cover_image_url, ...(listing?.images || []).map((image) => image.image_url)]
    .filter((url, index, all) => url && all.indexOf(url) === index)
}
const listOf = (data) => (Array.isArray(data) ? data : data?.listings || data?.items || [])

// ---------------------------------------------------------------- card (web SellListingCard)

function ListingCard({ listing, browse, onOpen }) {
  const { t, td } = useLanguage()
  const cover = coverOf(listing)
  const photoCount = listing.images?.length || (cover ? 1 : 0)
  const place = [[listing.city, listing.state].filter(Boolean).map((part) => td(part)).join(', '), listing.pincode].filter(Boolean).join(' - ')
  const facts = [
    areaLabel(listing, t) ? { key: 'area', Icon: Maximize2, text: areaLabel(listing, t) } : null,
    bhkLabel(listing, t) ? { key: 'bhk', Icon: BedDouble, text: bhkLabel(listing, t) } : null,
    Number(listing.bathrooms) > 0 ? { key: 'bath', Icon: Bath, text: `${listing.bathrooms} ${t('property.bathrooms')}` } : null,
    listing.facing ? { key: 'facing', Icon: Compass, text: facingLabel(t, listing.facing, td) } : null,
    listing.furnishing ? { key: 'furnishing', Icon: Sofa, text: codeLabel(t, 'property.furnishing', listing.furnishing, td) } : null,
    Number(listing.floors) > 0 ? { key: 'floors', Icon: Layers, text: `${listing.floors} ${t('property.floors')}` } : null,
  ].filter(Boolean).slice(0, 3)
  const showStatus = !browse && listing.status && listing.status !== 'LISTED'

  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.cardPhoto}>
        {cover ? (
          <Image source={imageSource(cover)} style={StyleFill} contentFit="cover" transition={150} />
        ) : (
          <View style={styles.cardNoPhoto}><Home size={36} color={COLORS.slate[300]} strokeWidth={1.5} /></View>
        )}
        <View style={styles.cardTagsLeft}>
          <Text style={[styles.tag, { backgroundColor: '#059669', color: '#ffffff' }]}>
            {codeLabel(t, 'property.listing', listing.listing_type, td) || t('property.listing.SALE')}
          </Text>
          {showStatus ? (
            <Text style={[styles.tag, { backgroundColor: STATUS_TONES[listing.status] || '#334155', color: '#ffffff' }]}>
              {STATUS_LABEL_KEYS[listing.status] ? t(STATUS_LABEL_KEYS[listing.status]) : td(readableCode(listing.status))}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.tag, styles.cardTypeTag]}>{codeLabel(t, 'property.type', listing.property_type, td) || t('property.property')}</Text>
        {photoCount > 0 ? (
          <View style={styles.cardPhotoCount}>
            <Camera size={12} color="#ffffff" />
            <Text style={styles.cardPhotoCountText}>{t('property.photosCount', { count: photoCount })}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.price}>{formatMoney(listing.price, listing.country)}</Text>
          {listing.is_negotiable ? <Text style={styles.negotiable}>{t('property.negotiable')}</Text> : null}
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{td(listing.title)}</Text>
        {place ? (
          <View style={styles.placeRow}>
            <MapPin size={13} color={COLORS.slate[500]} />
            <Text style={styles.placeText} numberOfLines={1}>{place}</Text>
          </View>
        ) : null}
        {facts.length ? (
          <View style={styles.facts}>
            {facts.map(({ key, Icon, text }) => (
              <View key={key} style={styles.fact}>
                <Icon size={13} color={COLORS.slate[500]} />
                <Text style={styles.factText} numberOfLines={1}>{text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.cardButtons}>
          <ActionButton small tone="outline" icon={Eye} label={t('property.viewDetails')} onPress={onOpen} style={{ flex: 1 }} />
          {!browse ? <ActionButton small icon={SlidersHorizontal} label={t('property.viewManage')} onPress={onOpen} style={{ flex: 1 }} /> : null}
        </View>
      </View>
    </Pressable>
  )
}

const StyleFill = { width: '100%', height: '100%' }

// ---------------------------------------------------------------- detail (web PropertyDetailPanel)

function DetailFact({ Icon, label, value }) {
  if (!value && value !== 0) return null
  return (
    <View style={styles.detailFact}>
      <View style={styles.detailFactLabelRow}>
        <Icon size={11} color={COLORS.slate[400]} />
        <Text style={styles.detailFactLabel}>{label}</Text>
      </View>
      <Text style={styles.detailFactValue}>{value}</Text>
    </View>
  )
}

function ListingVideo({ url }) {
  const player = useVideoPlayer(imageSource(url), (instance) => { instance.loop = false })
  return <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
}

function ListingDetail({ listing }) {
  const { t, td } = useLanguage()
  const [active, setActive] = useState(0)
  const [viewerAt, setViewerAt] = useState(null)
  const gallery = galleryOf(listing)
  const shown = gallery[Math.min(active, gallery.length - 1)]
  const area = (value) => (Number(value) > 0 ? `${formatNumber(value)} ${t('property.sqft')}` : '')
  const address = [listing.address, listing.city, listing.state].filter(Boolean).join(', ')

  return (
    <View>
      {shown ? (
        <>
          <Pressable onPress={() => setViewerAt(Math.min(active, gallery.length - 1))}>
            <Image source={imageSource(shown)} style={styles.detailPhoto} contentFit="contain" transition={150} />
          </Pressable>
          {gallery.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {gallery.map((url, index) => (
                <Pressable
                  key={url}
                  onPress={() => setActive(index)}
                  accessibilityLabel={`${t('property.photo')} ${index + 1}`}
                  style={[styles.thumb, index === active ? styles.thumbActive : null]}
                >
                  <Image source={imageSource(url)} style={StyleFill} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : (
        <View style={styles.noPhotos}><Text style={styles.muted}>{t('property.noPhotos')}</Text></View>
      )}
      {listing.video_url ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.smallHeading}>{t('property.detail.video')}</Text>
          <ListingVideo url={listing.video_url} />
        </View>
      ) : null}

      <Text style={styles.detailPrice}>{formatMoney(listing.price, listing.country)}</Text>
      {listing.is_negotiable ? <Text style={styles.muted}>{t('property.negotiable')}</Text> : null}
      {address || listing.pincode ? (
        <View style={[styles.placeRow, { marginTop: 10, alignItems: 'flex-start' }]}>
          <MapPin size={15} color={COLORS.brand[600]} style={{ marginTop: 1 }} />
          <Text style={styles.detailAddress}>{td(address)}{listing.pincode ? `, ${listing.pincode}` : ''}</Text>
        </View>
      ) : null}

      <View style={styles.detailFacts}>
        <DetailFact Icon={BedDouble} label={t('property.bedrooms')} value={listingBedrooms(listing) > 0 ? listingBedrooms(listing) : ''} />
        <DetailFact Icon={Bath} label={t('property.bathrooms')} value={Number(listing.bathrooms) > 0 ? listing.bathrooms : ''} />
        <DetailFact Icon={Maximize2} label={t('property.builtUpArea')} value={area(listing.built_up_area)} />
        <DetailFact Icon={Maximize2} label={t('property.carpetArea')} value={area(listing.carpet_area)} />
        <DetailFact Icon={Maximize2} label={t('property.landArea')} value={area(listing.land_area)} />
        <DetailFact Icon={Layers} label={t('property.floors')} value={Number(listing.floors) > 0 ? listing.floors : ''} />
        <DetailFact Icon={Sofa} label={t('property.furnishing')} value={codeLabel(t, 'property.furnishing', listing.furnishing, td)} />
        <DetailFact Icon={Compass} label={t('property.facing')} value={facingLabel(t, listing.facing, td)} />
        <DetailFact Icon={CalendarClock} label={t('property.age')} value={Number(listing.age_years) > 0 ? `${listing.age_years}` : ''} />
        <DetailFact Icon={Home} label={t('property.type')} value={codeLabel(t, 'property.type', listing.property_type, td)} />
      </View>

      {listing.description ? (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.smallHeading}>{t('property.about')}</Text>
          <Text style={styles.description}>{td(listing.description)}</Text>
        </View>
      ) : null}

      {listing.seller_name ? (
        <View style={styles.seller}>
          <Text style={styles.smallHeading}>{t('property.seller')}</Text>
          <View style={styles.sellerRow}>
            <Image source={avatarFromPath(listing.seller_profile_image_url, listing.seller_role)} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName} numberOfLines={1}>{td(listing.seller_name)}</Text>
              <View style={styles.placeRow}>
                <Building2 size={12} color={COLORS.slate[500]} />
                <Text style={styles.placeText} numberOfLines={1}>
                  {SELLER_ROLE_KEYS[listing.seller_role] ? t(SELLER_ROLE_KEYS[listing.seller_role]) : td(readableCode(listing.seller_role))}
                </Text>
              </View>
            </View>
          </View>
          {/* Exactly as the server decided: absent until a request is accepted. */}
          {listing.can_view_contact ? (
            <Text style={styles.contact}>{[listing.seller_phone, listing.seller_email].filter(Boolean).join(' · ')}</Text>
          ) : (
            <Text style={[styles.muted, { marginTop: 8 }]}>{t('property.contactHidden')}</Text>
          )}
        </View>
      ) : null}

      {viewerAt != null ? <ImageViewer images={gallery} index={viewerAt} onClose={() => setViewerAt(null)} /> : null}
    </View>
  )
}

// ---------------------------------------------------------------- the hub

/**
 * `tab` + `onTabChange` let a screen that draws its own tab bar (the Builder's
 * Buy & Sell, which adds Materials) drive the hub; `hideTabs` then hides the
 * hub's own Buy / Sell switch. Otherwise the hub keeps its tab itself.
 */
export default function PropertyBuySellHub({
  initialTab = 'buy', tab: controlledTab, onTabChange, hideTabs = false, projects = [], defaultCountry = 'India',
}) {
  const { t, td } = useLanguage()
  const { requireCompleteProfile } = useProfileGate()
  const currentUserId = useSelector((state) => state.auth.user?.id)
  const [ownTab, setOwnTab] = useState(initialTab)
  const tab = controlledTab || ownTab
  const setTab = (next) => { setOwnTab(next); onTabChange?.(next) }

  // --- Buy
  const [feed, setFeed] = useState({ listings: [], property_types: [], cities: [] })
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', propertyType: '', city: '', bedrooms: '' })

  // Search as you type: once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const search = searchInput.trim()
      setFilters((current) => (current.search === search ? current : { ...current, search }))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Only the newest search may fill the list.
  const feedRequest = useRef(0)
  const loadFeed = useCallback(async () => {
    const id = ++feedRequest.current
    setLoadingFeed(true)
    try {
      const data = await fetchPropertyListings(filters)
      if (id !== feedRequest.current) return
      setFeed({
        listings: listOf(data),
        property_types: Array.isArray(data?.property_types) ? data.property_types : [],
        cities: Array.isArray(data?.cities) ? data.cities : [],
      })
    } catch {
      if (id === feedRequest.current) setFeed({ listings: [], property_types: [], cities: [] })
    } finally {
      if (id === feedRequest.current) setLoadingFeed(false)
    }
  }, [filters])

  // --- Sell
  const [myListings, setMyListings] = useState([])
  const [loadingMine, setLoadingMine] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const loadMine = useCallback(async () => {
    setLoadingMine(true)
    try {
      setMyListings(listOf(await fetchMyPropertyListings()))
    } catch {
      setMyListings([])
    } finally {
      setLoadingMine(false)
    }
  }, [])

  useEffect(() => { if (tab === 'buy') loadFeed() }, [tab, loadFeed])
  useEffect(() => { if (tab === 'sell') loadMine() }, [tab, loadMine])

  // --- Detail
  const [openListing, setOpenListing] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [sending, setSending] = useState(false)

  // Always re-read: the detail response decides whether contact may be shown.
  const openDetail = async (listing) => {
    setOfferAmount('')
    setLoadingDetail(true)
    try {
      setOpenListing(await fetchPropertyListing(listing.id))
    } catch {
      setOpenListing(listing)
    } finally {
      setLoadingDetail(false)
    }
  }
  const refreshOpen = async (listingId) => {
    try {
      setOpenListing(await fetchPropertyListing(listingId))
    } catch {
      setOpenListing(null)
    }
  }

  const saveListing = async (payload, galleryUrls, options) => {
    await saveListingWithGallery({ editingListing, payload, galleryUrls, t, ...options })
    setFormOpen(false)
    setEditingListing(null)
    await loadMine()
  }

  const changeStatus = async (listing, status) => {
    setBusyId(listing.id)
    try {
      await updatePropertyListingStatus(listing.id, status)
      toast.success(t('property.msg.statusUpdated'))
      await loadMine()
      await refreshOpen(listing.id)
    } catch (error) {
      toast.error(apiErrorText(error, t('property.msg.statusFailed')))
    } finally {
      setBusyId(null)
    }
  }

  const removeListing = (listing) => {
    Alert.alert(t('mobile.account.property.deleteTitle'), t('mobile.account.property.deleteBody', { title: td(listing.title) }), [
      { text: t('dash.common.cancel'), style: 'cancel' },
      {
        text: t('dash.common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(listing.id)
          try {
            await deletePropertyListing(listing.id)
            toast.success(t('property.msg.deleted'))
            setOpenListing(null)
            await loadMine()
          } catch (error) {
            toast.error(apiErrorText(error, t('property.msg.deleteFailed')))
          } finally {
            setBusyId(null)
          }
        },
      },
    ])
  }

  const startEdit = (listing) => {
    // The detail response is the full listing (gallery included), so a save
    // never replaces the photos with an empty list.
    setOpenListing(null)
    setTab('sell')
    setEditingListing(listing)
    setFormOpen(true)
  }

  // An enquiry is a project request: it needs a complete profile, and resumes
  // with the same listing and offer once the profile is saved.
  const sendRequest = async (listingId, offer) => {
    if (!listingId) return
    if (requireCompleteProfile(() => sendRequest(listingId, offer))) return
    setSending(true)
    try {
      await sendPropertyRequest(listingId, offer)
      toast.success(t('property.request.sent'))
      await refreshOpen(listingId)
    } catch (error) {
      toast.error(apiErrorText(error, t('property.request.failed')))
    } finally {
      setSending(false)
    }
  }

  const ownListing = openListing && currentUserId != null && String(openListing.seller_id) === String(currentUserId)
  const bhkOptions = [1, 2, 3, 4, 5].map((count) => ({ value: String(count), label: t('ui.owner.bhkPlus', { count }) }))

  const detailFooter = !openListing ? null : ownListing ? (
    <View style={styles.footerWrap}>
      <ActionButton small icon={Pencil} label={t('property.editProperty')} disabled={busyId === openListing.id} onPress={() => startEdit(openListing)} />
      {(STATUS_ACTIONS[openListing.status] || []).map((action) => (
        <ActionButton
          key={action.status}
          small
          tone={action.primary ? 'primary' : 'outline'}
          label={t(action.labelKey)}
          disabled={busyId === openListing.id}
          onPress={() => changeStatus(openListing, action.status)}
        />
      ))}
      <ActionButton small tone="danger" icon={Trash2} label={t('dash.common.delete')} disabled={busyId === openListing.id} onPress={() => removeListing(openListing)} />
    </View>
  ) : (
    <View style={styles.offerRow}>
      <View style={{ flex: 1 }}>
        <LabeledInput
          value={offerAmount}
          onChangeText={(value) => setOfferAmount(value.replace(/[^\d]/g, ''))}
          placeholder={t('property.request.offerPh')}
          keyboardType="number-pad"
          style={{ marginBottom: 0 }}
        />
        {/* The offer is in the property's own currency. */}
        <BudgetInWords value={offerAmount} country={openListing.country} style={{ marginTop: 2 }} />
      </View>
      <ActionButton icon={Send} label={t('property.request.send')} busy={sending} disabled={sending} onPress={() => sendRequest(openListing.id, offerAmount)} />
    </View>
  )

  return (
    <View>
      {!hideTabs ? (
        <View style={styles.tabRow}>
          <View style={{ flex: 1 }}>
            <SegmentTabs
              tabs={[{ id: 'buy', label: t('property.tab.buy'), icon: Search }, { id: 'sell', label: t('property.tab.sell'), icon: Store }]}
              active={tab}
              onChange={setTab}
            />
          </View>
        </View>
      ) : null}

      {tab === 'buy' ? (
        <View>
          <SearchBox value={searchInput} onChangeText={setSearchInput} placeholder={t('property.searchPh')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <SelectChip
              placeholder={t('property.filter.allTypes')}
              value={filters.propertyType}
              options={feed.property_types.map((type) => ({ value: type, label: codeLabel(t, 'property.type', type, td) }))}
              onChange={(value) => setFilters((current) => ({ ...current, propertyType: value }))}
            />
            <SelectChip
              placeholder={t('property.filter.allCities')}
              value={filters.city}
              options={feed.cities.map((city) => ({ value: city, label: td(city) }))}
              onChange={(value) => setFilters((current) => ({ ...current, city: value }))}
            />
            <SelectChip
              placeholder={t('property.filter.anyBhk')}
              value={filters.bedrooms}
              options={bhkOptions}
              onChange={(value) => setFilters((current) => ({ ...current, bedrooms: value }))}
            />
          </ScrollView>
          {loadingFeed ? (
            <View style={styles.loading}><ActivityIndicator color={COLORS.brand[700]} /></View>
          ) : feed.listings.length ? (
            feed.listings.map((listing) => <ListingCard key={listing.id} listing={listing} browse onOpen={() => openDetail(listing)} />)
          ) : (
            <Empty Icon={Search} title={t('property.empty.noneTitle')} message={t('property.empty.noneMessage')} />
          )}
        </View>
      ) : (
        <View>
          <ActionButton
            icon={Plus}
            label={t('property.addProperty')}
            onPress={() => { setEditingListing(null); setFormOpen(true) }}
            style={{ marginBottom: 12 }}
          />
          {loadingMine ? (
            <View style={styles.loading}><ActivityIndicator color={COLORS.brand[700]} /></View>
          ) : myListings.length ? (
            myListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => openDetail(listing)} />)
          ) : (
            <Empty Icon={Store} title={t('property.empty.mineTitle')} message={t('property.empty.mineMessage')} />
          )}
        </View>
      )}

      {loadingDetail && !openListing ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
          <View style={styles.busy}><ActivityIndicator size="large" color="#ffffff" /></View>
        </Modal>
      ) : null}

      <SheetModal
        visible={Boolean(openListing)}
        tall
        title={openListing ? td(openListing.title) : ''}
        subtitle={openListing ? [
          codeLabel(t, 'property.type', openListing.property_type, td) || t('property.property'),
          codeLabel(t, 'property.listing', openListing.listing_type, td),
          ownListing && STATUS_LABEL_KEYS[openListing.status] ? t(STATUS_LABEL_KEYS[openListing.status]) : '',
        ].filter(Boolean).join(' · ') : ''}
        onClose={() => setOpenListing(null)}
        footer={detailFooter}
      >
        {openListing ? <ListingDetail key={openListing.id} listing={openListing} /> : null}
      </SheetModal>

      <SheetModal
        visible={formOpen}
        tall
        title={editingListing ? t('property.form.editTitle') : t('property.form.addTitle')}
        subtitle={t('mobile.account.property.draftNote')}
        onClose={() => { setFormOpen(false); setEditingListing(null) }}
      >
        {formOpen ? (
          <ListingForm
            key={editingListing?.id || 'new'}
            listing={editingListing}
            projects={projects}
            defaultCountry={defaultCountry}
            onSaved={saveListing}
            onCancel={() => { setFormOpen(false); setEditingListing(null) }}
          />
        ) : null}
      </SheetModal>
    </View>
  )
}

function Empty({ Icon, title, message }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon size={20} color={COLORS.brand[700]} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

const styles = createStyles((c) => ({
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  filters: { gap: 8, paddingVertical: 10 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  busy: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.3)' },

  card: { marginBottom: 14, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  cardPhoto: { height: 176, backgroundColor: c.sunken || c.borderSoft },
  cardNoPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardTagsLeft: { position: 'absolute', left: 12, top: 12, gap: 6, alignItems: 'flex-start' },
  tag: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  cardTypeTag: { position: 'absolute', right: 12, top: 12, backgroundColor: '#ffffff', color: '#0f172a' },
  cardPhotoCount: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4 },
  cardPhotoCountText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  cardBody: { padding: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  price: { flexShrink: 1, fontSize: 21, fontWeight: '800', color: c.brandTextStrong },
  negotiable: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#fff7ed', color: '#ea580c', paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, fontWeight: '700' },
  cardTitle: { marginTop: 4, fontSize: 15, fontWeight: '800', color: c.text },
  placeRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeText: { flexShrink: 1, fontSize: 12.5, color: c.textMuted, fontWeight: '600' },
  facts: { marginTop: 10, flexDirection: 'row', gap: 6 },
  fact: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, backgroundColor: c.borderSoft, paddingHorizontal: 6, paddingVertical: 8 },
  factText: { flexShrink: 1, fontSize: 11, fontWeight: '600', color: c.textSoft },
  cardButtons: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: c.borderSoft, flexDirection: 'row', gap: 8 },

  detailPhoto: { height: 240, width: '100%', borderRadius: 14, backgroundColor: c.borderSoft },
  thumbs: { gap: 8, paddingTop: 8 },
  thumb: { height: 52, width: 74, overflow: 'hidden', borderRadius: 8, borderWidth: 2, borderColor: c.border },
  thumbActive: { borderColor: COLORS.brand[600] },
  noPhotos: { height: 160, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border },
  video: { height: 220, width: '100%', borderRadius: 14, backgroundColor: '#000000' },
  detailPrice: { marginTop: 14, fontSize: 24, fontWeight: '800', color: c.brandTextStrong },
  detailAddress: { flex: 1, fontSize: 13.5, fontWeight: '600', color: c.text },
  detailFacts: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailFact: { width: '48%', flexGrow: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
  detailFactLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailFactLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: c.textFaint },
  detailFactValue: { marginTop: 3, fontSize: 13.5, fontWeight: '800', color: c.text },
  smallHeading: { marginBottom: 6, fontSize: 13.5, fontWeight: '800', color: c.text },
  description: { fontSize: 13, lineHeight: 19, color: c.textMuted },
  seller: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 12 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.borderSoft },
  sellerName: { fontSize: 14, fontWeight: '800', color: c.text },
  contact: { marginTop: 8, fontSize: 12.5, fontWeight: '700', color: c.text },
  muted: { fontSize: 12, fontWeight: '500', color: c.textMuted },

  footerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  offerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandSoft },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: '800', color: c.text },
  emptyText: { marginTop: 4, textAlign: 'center', fontSize: 12.5, color: c.textMuted },
}))
