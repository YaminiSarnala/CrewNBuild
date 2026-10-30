// The "Sell" side of web components/property/PropertyBuySellHub.jsx +
// PropertyForm.jsx, for the Builder's Buy & Sell: the builder's own listings
// (GET /property-listings/mine), create / edit (POST, PATCH /property-listings),
// the gallery (PUT /property-listings/{id}/images), the lifecycle moves
// (PATCH /property-listings/{id}/status) and delete. The seller is always taken
// from the token on the server. Photos go through POST /files/upload.
// Strings use the web property.* keys; mobile-only ones are mobile.account.*.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, Alert, Switch } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Plus, Pencil, Trash2, ImagePlus } from 'lucide-react-native'
import { Panel, PanelState, useAsyncData } from '../DashboardShell'
import {
  createPropertyListing, deletePropertyListing, fetchMyPropertyListings, fetchPropertyListing, updatePropertyListing,
  updatePropertyListingImages, updatePropertyListingStatus,
} from '../../api/properties'
import { uploadLocalFile } from '../../api/upload'
import { imageUrl } from '../../api/client'
import { apiErrorText, asList, money } from '../../utils/builderHelpers'
import { ActionButton, Badge, LabeledInput, Notice, SegmentTabs, SheetModal } from './BuilderUi'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'

// [stored code, label key] -- the code is what is saved; only the label is translated.
const PROPERTY_TYPES = ['HOUSE', 'INDEPENDENT_HOUSE', 'VILLA', 'APARTMENT', 'PLOT', 'COMMERCIAL'].map((code) => [code, `property.type.${code}`])
const LISTING_TYPES = [['SALE', 'property.listing.SALE'], ['RENT', 'property.listing.RENT']]
const FURNISHING = [['', 'dash.common.notSet'], ['UNFURNISHED', 'property.furnishing.UNFURNISHED'], ['SEMI_FURNISHED', 'property.furnishing.SEMI_FURNISHED'], ['FULLY_FURNISHED', 'property.furnishing.FULLY_FURNISHED']]
const FACING = [['', 'dash.common.notSet'], ['EAST', 'ui.owner.facingEast'], ['WEST', 'ui.owner.facingWest'], ['NORTH', 'ui.owner.facingNorth'], ['SOUTH', 'ui.owner.facingSouth'], ['NORTH_EAST', 'ui.owner.facingNorthEast'], ['NORTH_WEST', 'ui.owner.facingNorthWest'], ['SOUTH_EAST', 'ui.owner.facingSouthEast'], ['SOUTH_WEST', 'ui.owner.facingSouthWest']]
// Same keys as web StatusPill's STATUS_KEYS for the listing lifecycle.
const STATUS_LABEL_KEYS = { DRAFT: 'ui.shared.statusDraft', LISTED: 'ui.shared.statusListed', UNDER_OFFER: 'ui.shared.statusUnderOffer', SOLD: 'ui.shared.statusSold', WITHDRAWN: 'ui.shared.statusWithdrawn' }

// Which lifecycle moves are offered per status (the server owns the rule).
const STATUS_ACTIONS = {
  DRAFT: [{ status: 'LISTED', labelKey: 'property.action.publish', primary: true }],
  LISTED: [{ status: 'UNDER_OFFER', labelKey: 'property.action.markUnderOffer' }, { status: 'SOLD', labelKey: 'property.action.markSold' }, { status: 'WITHDRAWN', labelKey: 'property.action.withdraw' }],
  UNDER_OFFER: [{ status: 'SOLD', labelKey: 'property.action.markSold' }, { status: 'LISTED', labelKey: 'property.action.relist' }, { status: 'WITHDRAWN', labelKey: 'property.action.withdraw' }],
  WITHDRAWN: [{ status: 'LISTED', labelKey: 'property.action.relist', primary: true }],
  SOLD: [],
}

const asText = (value) => (value === null || value === undefined ? '' : String(value))
const numberOrZero = (value) => (value === '' || value === null || value === undefined ? 0 : Number(value))
const uploadedUrl = (uploaded) => uploaded?.url || uploaded?.file_url || uploaded?.path || ''

function blankListing(country) {
  return {
    title: '', description: '', property_type: 'HOUSE', listing_type: 'SALE', address: '', pincode: '',
    country: country || 'India', state: '', city: '', price: '', is_negotiable: false, carpet_area: '',
    built_up_area: '', land_area: '', bedrooms: '', bathrooms: '', floors: '1', furnishing: '', age_years: '',
    facing: '', floor_type: '', source_project_id: '',
  }
}

function listingToForm(listing) {
  return {
    title: listing.title || '', description: listing.description || '', property_type: listing.property_type || 'HOUSE',
    listing_type: listing.listing_type || 'SALE', address: listing.address || '', pincode: listing.pincode || '',
    country: listing.country || 'India', state: listing.state || '', city: listing.city || '', price: asText(listing.price),
    is_negotiable: Boolean(listing.is_negotiable), carpet_area: asText(listing.carpet_area), built_up_area: asText(listing.built_up_area),
    land_area: asText(listing.land_area), bedrooms: asText(listing.bedrooms), bathrooms: asText(listing.bathrooms),
    floors: asText(listing.floors) || '1', furnishing: listing.furnishing || '', age_years: asText(listing.age_years),
    facing: listing.facing || '', floor_type: listing.floor_type || '', source_project_id: asText(listing.source_project_id),
  }
}

async function pickImages(multiple, t) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    Alert.alert(t('mobile.account.permissionTitle'), t('mobile.account.permissionPropertyPhotos'))
    return []
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: multiple })
  return result.canceled ? [] : (result.assets || [])
}

function ListingForm({ listing, projects, defaultCountry, onSaved, onCancel }) {
  const { t } = useLanguage()
  const editing = Boolean(listing?.id)
  const [details, setDetails] = useState(() => (editing ? listingToForm(listing) : blankListing(defaultCountry)))
  const [coverImageUrl, setCoverImageUrl] = useState(listing?.cover_image_url || '')
  const [galleryUrls, setGalleryUrls] = useState(() => (listing?.images || []).map((image) => image.image_url).filter(Boolean))
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const canPublish = !editing || listing?.status === 'DRAFT'
  const update = (field, value) => setDetails((current) => ({ ...current, [field]: value }))
  const numeric = (field) => (value) => update(field, value.replace(/[^\d.]/g, ''))

  async function addPhotos(cover) {
    const assets = await pickImages(!cover, t)
    if (!assets.length) return
    setUploading(true)
    setMessage('')
    try {
      const urls = []
      for (const asset of assets) urls.push(uploadedUrl(await uploadLocalFile(asset, 'property.jpg')))
      if (cover) setCoverImageUrl(urls[0])
      else setGalleryUrls((current) => [...current, ...urls.filter(Boolean)])
    } catch {
      setMessage(t('property.form.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function submit(publish) {
    if (!details.title.trim()) { setMessage(t('mobile.account.property.enterTitle')); return }
    if (!details.address.trim() || !details.pincode.trim()) { setMessage(t('mobile.account.property.enterAddress')); return }
    if (!(Number(details.price) > 0)) { setMessage(t('mobile.account.property.enterPrice')); return }
    setSaving(publish ? 'publish' : 'save')
    setMessage('')
    // Exactly the fields the backend schema declares (web PropertyForm).
    const payload = {
      title: details.title.trim(),
      description: details.description.trim(),
      property_type: details.property_type,
      listing_type: details.listing_type,
      address: details.address.trim(),
      pincode: details.pincode.trim(),
      country: details.country || defaultCountry || 'India',
      state: details.state.trim() || null,
      city: details.city.trim() || null,
      price: numberOrZero(details.price),
      is_negotiable: Boolean(details.is_negotiable),
      carpet_area: numberOrZero(details.carpet_area),
      built_up_area: numberOrZero(details.built_up_area),
      land_area: details.property_type === 'APARTMENT' ? 0 : numberOrZero(details.land_area),
      bedrooms: details.property_type === 'PLOT' ? 0 : numberOrZero(details.bedrooms),
      bathrooms: numberOrZero(details.bathrooms),
      floors: numberOrZero(details.floors) || 1,
      floor_type: details.floor_type || null,
      furnishing: details.furnishing || null,
      age_years: numberOrZero(details.age_years),
      facing: details.facing || null,
      cover_image_url: coverImageUrl || null,
      video_url: listing?.video_url || null,
      source_project_id: details.source_project_id ? Number(details.source_project_id) : null,
    }
    try {
      await onSaved(payload, galleryUrls, { publish })
    } catch (error) {
      setMessage(apiErrorText(error, t('property.form.saveFailed')))
    } finally {
      setSaving('')
    }
  }

  return (
    <View>
      <LabeledInput label={`${t('property.form.titlePh')} *`} value={details.title} onChangeText={(value) => update('title', value)} />
      <Text style={styles.text}>{t('property.type')}</Text>
      <SegmentTabs dense tabs={PROPERTY_TYPES.map(([id, key]) => ({ id, label: t(key) }))} active={details.property_type} onChange={(value) => update('property_type', value)} />
      <Text style={styles.text2}>{t('mobile.account.property.listingFor')}</Text>
      <SegmentTabs dense tabs={LISTING_TYPES.map(([id, key]) => ({ id, label: t(key) }))} active={details.listing_type} onChange={(value) => update('listing_type', value)} />
      <View style={styles.view}>
        <LabeledInput label={t('dash.common.description')} value={details.description} onChangeText={(value) => update('description', value)} multiline />
        <LabeledInput label={`${t('property.form.addressPh')} *`} value={details.address} onChangeText={(value) => update('address', value)} />
        <LabeledInput label={`${t('dash.common.pincode')} *`} value={details.pincode} onChangeText={(value) => update('pincode', value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} />
        <LabeledInput label={t('property.form.cityPh')} value={details.city} onChangeText={(value) => update('city', value)} />
        <LabeledInput label={t('property.form.statePh')} value={details.state} onChangeText={(value) => update('state', value)} />
        <LabeledInput label={`${t('property.price')} *`} value={details.price} onChangeText={numeric('price')} keyboardType="numeric" hint={Number(details.price) > 0 ? money(details.price, details.country) : ''} />
      </View>
      <View style={styles.view2}>
        <Text style={styles.text3}>{t('property.negotiable')}</Text>
        <Switch value={details.is_negotiable} onValueChange={(value) => update('is_negotiable', value)} trackColor={{ true: COLORS.brand[500] }} />
      </View>
      <LabeledInput label={t('property.form.carpetPh')} value={details.carpet_area} onChangeText={numeric('carpet_area')} keyboardType="numeric" />
      <LabeledInput label={t('property.form.builtUpPh')} value={details.built_up_area} onChangeText={numeric('built_up_area')} keyboardType="numeric" />
      {details.property_type !== 'APARTMENT' ? <LabeledInput label={t('property.form.landPh')} value={details.land_area} onChangeText={numeric('land_area')} keyboardType="numeric" /> : null}
      {details.property_type !== 'PLOT' ? <LabeledInput label={t('property.bedrooms')} value={details.bedrooms} onChangeText={numeric('bedrooms')} keyboardType="number-pad" /> : null}
      <LabeledInput label={t('property.bathrooms')} value={details.bathrooms} onChangeText={numeric('bathrooms')} keyboardType="number-pad" />
      <LabeledInput label={t('property.floors')} value={details.floors} onChangeText={numeric('floors')} keyboardType="number-pad" />
      <LabeledInput label={t('property.age')} value={details.age_years} onChangeText={numeric('age_years')} keyboardType="number-pad" />
      <Text style={styles.text}>{t('property.furnishing')}</Text>
      <SegmentTabs dense tabs={FURNISHING.map(([id, key]) => ({ id, label: t(key) }))} active={details.furnishing} onChange={(value) => update('furnishing', value)} />
      <Text style={styles.text2}>{t('property.facing')}</Text>
      <SegmentTabs dense tabs={FACING.map(([id, key]) => ({ id, label: t(key) }))} active={details.facing} onChange={(value) => update('facing', value)} />
      {projects.length ? (
        <>
          <Text style={styles.text2}>{t('mobile.account.property.sourceProject')}</Text>
          <SegmentTabs
            dense
            tabs={[{ id: '', label: t('property.form.noSourceProject') }, ...projects.map((project) => ({ id: String(project.id), label: project.title || project.project_title || t('ui.requests.project', { n: project.id }) }))]}
            active={details.source_project_id}
            onChange={(value) => update('source_project_id', value)}
          />
        </>
      ) : null}

      <Text style={styles.text4}>{t('mobile.account.property.coverPhoto')}</Text>
      <View style={styles.view3}>
        {coverImageUrl ? <Image source={{ uri: imageUrl(coverImageUrl) }} style={{ width: 84, height: 64, borderRadius: 10 }} contentFit="cover" /> : null}
        <ActionButton small tone="brandOutline" icon={ImagePlus} label={coverImageUrl ? t('mobile.account.property.changeCover') : t('property.form.uploadCover')} disabled={uploading} onPress={() => addPhotos(true)} />
      </View>
      <Text style={styles.text2}>{t('cps.gallery')} ({galleryUrls.length})</Text>
      <View style={styles.view4}>
        {galleryUrls.map((url) => (
          <Pressable key={url} onPress={() => setGalleryUrls((current) => current.filter((item) => item !== url))} style={styles.pressable}>
            <Image source={{ uri: imageUrl(url) }} style={{ width: 64, height: 64 }} contentFit="cover" />
          </Pressable>
        ))}
        <Pressable onPress={() => addPhotos(false)} disabled={uploading} style={[styles.pressable2, uploading ? styles.pressable3 : null]}>
          <ImagePlus size={18} color={COLORS.brand[700]} />
        </Pressable>
      </View>
      {galleryUrls.length ? <Text style={styles.text5}>{t('mobile.account.tapPhotoToRemove')}</Text> : null}

      {message ? <View style={styles.view}><Notice tone="error" text={message} /></View> : null}
      <View style={styles.view5}>
        <ActionButton label={editing ? t('property.form.saveChanges') : t('property.form.saveDraft')} tone="outline" busy={saving === 'save'} disabled={Boolean(saving) || uploading} onPress={() => submit(false)} />
        {canPublish ? <ActionButton label={t('property.form.saveAndPublish')} busy={saving === 'publish'} disabled={Boolean(saving) || uploading} onPress={() => submit(true)} /> : null}
        <ActionButton label={t('dash.common.cancel')} tone="outline" disabled={Boolean(saving)} onPress={onCancel} />
      </View>
    </View>
  )
}

export default function PropertySellSection({ projects = [], defaultCountry = 'India' }) {
  const { t } = useLanguage()
  const mine = useAsyncData(() => fetchMyPropertyListings(), [])
  const [formOpen, setFormOpen] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState(null)
  const listings = asList(mine.data, 'listings', 'items')

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  const saveListing = async (payload, galleryUrls, { publish = false } = {}) => {
    const saved = editingListing
      ? await updatePropertyListing(editingListing.id, payload)
      : await createPropertyListing(payload)
    // The gallery is replaced as a whole, ordered list.
    await updatePropertyListingImages(saved.id, galleryUrls)
    let text = editingListing ? t('property.msg.updated') : t('property.msg.draftSaved')
    if (publish) {
      try {
        await updatePropertyListingStatus(saved.id, 'LISTED')
        text = t('property.msg.published')
      } catch {
        text = t('property.msg.publishFailed')
      }
    }
    setFormOpen(false)
    setEditingListing(null)
    setMessage({ tone: 'success', text })
    await mine.reload()
  }

  // Edit opens the FULL listing (as the web does), so its gallery is never
  // replaced with an empty list by a save that did not touch the photos.
  const openEdit = async (listing) => {
    setBusyId(listing.id)
    try {
      const full = await fetchPropertyListing(listing.id)
      setEditingListing(full || listing)
      setFormOpen(true)
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, t('mobile.account.property.openFailed')) })
    } finally {
      setBusyId(null)
    }
  }

  const changeStatus = async (listing, status) => {
    setBusyId(listing.id)
    try {
      await updatePropertyListingStatus(listing.id, status)
      setMessage({ tone: 'success', text: t('property.msg.statusUpdated') })
      await mine.reload()
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, t('property.msg.statusFailed')) })
    } finally {
      setBusyId(null)
    }
  }

  const removeListing = (listing) => {
    Alert.alert(t('mobile.account.property.deleteTitle'), t('mobile.account.property.deleteBody', { title: listing.title }), [
      { text: t('dash.common.cancel'), style: 'cancel' },
      {
        text: t('dash.common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(listing.id)
          try {
            await deletePropertyListing(listing.id)
            setMessage({ tone: 'success', text: t('property.msg.deleted') })
            await mine.reload()
          } catch (error) {
            setMessage({ tone: 'error', text: apiErrorText(error, t('property.msg.deleteFailed')) })
          } finally {
            setBusyId(null)
          }
        },
      },
    ])
  }

  return (
    <>
      <Panel
        title={t('property.myProperties')}
        action={<ActionButton small icon={Plus} label={t('property.addProperty')} onPress={() => { setEditingListing(null); setFormOpen(true) }} />}
      >
        <Notice tone={message?.tone} text={message?.text} />
        <PanelState loading={mine.loading} error={mine.error} empty={!listings.length} emptyText={`${t('property.empty.mineTitle')}\n${t('property.empty.mineMessage')}`}>
          {listings.map((listing) => (
            <View key={listing.id} style={styles.view6}>
              <View style={styles.view7}>
                {listing.cover_image_url ? (
                  <Image source={{ uri: imageUrl(listing.cover_image_url) }} style={{ width: 72, height: 60, borderRadius: 10 }} contentFit="cover" />
                ) : null}
                <View style={styles.view8}>
                  <Text style={styles.text6} numberOfLines={1}>{listing.title}</Text>
                  <Text style={styles.text7} numberOfLines={1}>
                    {[listing.city, listing.pincode].filter(Boolean).join(' · ')} · {listing.listing_type === 'RENT' ? t('property.listing.RENT') : t('property.listing.SALE')}
                  </Text>
                  <Text style={styles.text8}>
                    {money(listing.price, listing.country)}{listing.is_negotiable ? ` · ${t('property.negotiable')}` : ''}
                  </Text>
                </View>
                <Badge label={STATUS_LABEL_KEYS[listing.status] ? t(STATUS_LABEL_KEYS[listing.status]) : listing.status} />
              </View>
              <View style={styles.view9}>
                {(STATUS_ACTIONS[listing.status] || []).map((action) => (
                  <ActionButton
                    key={action.status}
                    small
                    tone={action.primary ? 'primary' : 'outline'}
                    label={t(action.labelKey)}
                    disabled={busyId === listing.id}
                    onPress={() => changeStatus(listing, action.status)}
                  />
                ))}
                {listing.status !== 'SOLD' ? (
                  <ActionButton small tone="brandOutline" icon={Pencil} label={t('dash.common.edit')} disabled={busyId === listing.id} onPress={() => openEdit(listing)} />
                ) : null}
                <ActionButton small tone="danger" icon={Trash2} label={t('dash.common.delete')} disabled={busyId === listing.id} onPress={() => removeListing(listing)} />
              </View>
            </View>
          ))}
        </PanelState>
      </Panel>

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
    </>
  )
}

const styles = createStyles((c) => ({
  text: { marginBottom: 5.25, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  text2: { marginBottom: 5.25, marginTop: 10.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  view: { marginTop: 10.5 },
  view2: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5, paddingVertical: 7 },
  text3: { fontSize: 13, fontWeight: '700', color: c.textSoft },
  text4: { marginBottom: 5.25, marginTop: 14, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  view3: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  view4: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pressable: { overflow: 'hidden', borderRadius: 8 },
  pressable2: { height: 56, width: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9dc5af', backgroundColor: c.brandSoft },
  pressable3: { opacity: 0.5 },
  text5: { marginTop: 3.5, fontSize: 10, color: c.textFaint },
  view5: { marginTop: 14, gap: 7 },
  view6: { marginBottom: 10.5, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 10.5 },
  view7: { flexDirection: 'row', gap: 10.5 },
  view8: { flex: 1 },
  text6: { fontSize: 14, fontWeight: '800', color: c.text },
  text7: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  text8: { marginTop: 1.75, fontSize: 13, fontWeight: '800', color: c.brandTextStrong },
  view9: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
}))
