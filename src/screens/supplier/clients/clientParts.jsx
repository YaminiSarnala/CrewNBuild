// What the supplier's client screens share: the request actions (send,
// accept, reject, withdraw -- the web SupplierDashboard handlers), how a
// client request reads, and two full-screen profiles:
//   ClientProfileSheet   a nearby client found in Find Clients (web
//                        supplierPanels ClientProfileModal)
//   RequestProfileSheet  the other side of an accepted request (web
//                        components/dashboard/requestProfileDashboard)
// Contact details are shown only when the server says the relationship
// allows it (can_view_contact); otherwise they read as locked.
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { FileText, Globe, Lock, Mail, MapPin, Phone, Send, Star } from 'lucide-react-native'
import { acceptProjectRequest, rejectProjectRequest, sendProjectRequest, withdrawProjectRequest } from '../../../api/requests'
import { imageSource, imageUrl } from '../../../api/client'
import { useProfileGate } from '../../../hooks/useProfileGate'
import { useLanguage } from '../../../i18n/LanguageContext'
import {
  BUSINESS_TYPE_KEYS, DOCUMENT_TYPE_KEYS, EQUIPMENT_OPTION_KEYS, SERVICE_OPTION_KEYS, SUPPLIER_CATEGORY_KEYS, optionLabel,
} from '../../../i18n/optionKeys'
import { userAvatarSource, avatarFromPath } from '../../../utils/avatars'
import { constructionTypeLabel } from '../../../utils/roleLabels'
import { formatMoney } from '../../../utils/countryConfig'
import { formatNumber } from '../../../utils/formatters'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'
import SheetHeader from '../SheetHeader'

export const REQUEST_STATUS_KEYS = {
  pending: 'ui.status.pending',
  accepted: 'ui.requests.accepted',
  rejected: 'ui.requests.rejected',
  withdrawn: 'ui.shared.statusWithdrawn',
}
export const REQUEST_STATUS_DOT = {
  pending: '#fbbf24',
  accepted: '#10b981',
  rejected: '#fb7185',
  withdrawn: '#94a3b8',
}
// Who sent a client request, by the role the server reports.
export const CLIENT_ROLE_KEYS = {
  OWNER: 'role.owner',
  CONTRACTOR: 'role.contractor',
  ENGINEER: 'role.engineer',
  SUPPLIER: 'role.supplier',
}
const PROFILE_ROLE_KEYS = { ...CLIENT_ROLE_KEYS, PROFILE: 'ui.profile' }

export const listOf = (value) => (Array.isArray(value) ? value.filter(Boolean) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean))

/** One reading of a request for every view, so no view shows an action another would not. */
export function requestView(request) {
  const status = String(request.status || '').toLowerCase()
  return {
    name: request.profile_name || request.sender_name,
    status,
    // Only a request that came in and is still waiting can be answered.
    canAct: status === 'pending' && !request.is_sender,
    // Contact details ride along with an accepted relationship only.
    canOpen: status === 'accepted',
    // The supplier's own request, still unanswered, can be taken back.
    canWithdraw: status === 'pending' && Boolean(request.is_sender),
  }
}

/** The key Find Clients remembers a sent request under. */
export const clientRequestKey = (client) => `${client.type}-${client.user_id}-${client.project_id || 'profile'}`

/**
 * Send / accept / reject / withdraw, with the web's messages. `reload` runs
 * after every change. Sending and accepting need a complete profile.
 */
export function useClientRequestActions(reload) {
  const { t, td } = useLanguage()
  const { requireCompleteProfile } = useProfileGate()
  const [message, setMessage] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [sentKeys, setSentKeys] = useState({})
  const timer = useRef(null)

  // A message clears itself after 4 s, as on the web.
  const say = useCallback((tone, text) => {
    clearTimeout(timer.current)
    setMessage({ tone, text })
    timer.current = setTimeout(() => setMessage(null), 4000)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  async function send(client) {
    if (requireCompleteProfile(() => send(client))) return
    const key = clientRequestKey(client)
    setSendingId(client.user_id)
    try {
      await sendProjectRequest({ receiver_id: client.user_id, project_id: client.project_id || null, request_type: `SUPPLIER_TO_${client.type}` })
      say('success', t('dash.supplier.msg.sentTo', { name: td(client.name) }))
      setSentKeys((current) => ({ ...current, [key]: true }))
      await reload?.()
    } catch (error) {
      const detail = error?.response?.data?.detail
      say('error', typeof detail === 'string' && detail ? detail : t('dash.supplier.msg.unableSend'))
      if (detail === 'Request already sent') setSentKeys((current) => ({ ...current, [key]: true }))
    } finally {
      setSendingId(null)
    }
  }

  async function run(id, call, okKey, failKey) {
    setBusyId(id)
    try {
      await call(id)
      say('success', t(okKey))
      await reload?.()
    } catch (error) {
      const detail = error?.response?.data?.detail
      say('error', typeof detail === 'string' && detail ? detail : t(failKey))
    } finally {
      setBusyId(null)
    }
  }

  async function accept(id) {
    if (requireCompleteProfile(() => accept(id))) return
    await run(id, acceptProjectRequest, 'dash.supplier.msg.accepted', 'dash.supplier.msg.unableAccept')
  }
  const reject = (id) => run(id, rejectProjectRequest, 'dash.supplier.msg.rejected', 'dash.supplier.msg.unableReject')
  // Taken back, it stays in the list as Withdrawn.
  const withdraw = (id) => run(id, withdrawProjectRequest, 'dash.msg.requestWithdrawn', 'dash.err.withdrawRequest')

  return { message, setMessage, send, accept, reject, withdraw, sendingId, busyId, sentKeys }
}

/** A request's status as a dot and words, "· Sent" on the supplier's own. */
export function RequestStatusLine({ request }) {
  const { t } = useLanguage()
  const { status } = requestView(request)
  return (
    <View style={styles.statusLine}>
      <View style={[styles.statusDot, { backgroundColor: REQUEST_STATUS_DOT[status] || COLORS.slate[300] }]} />
      <Text style={styles.statusText} numberOfLines={1}>
        {`${REQUEST_STATUS_KEYS[status] ? t(REQUEST_STATUS_KEYS[status]) : request.status}${request.is_sender ? ` · ${t('dash.sent')}` : ''}`}
      </Text>
    </View>
  )
}

export function Avatar({ source, size = 40, square = false }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: square ? 12 : size / 2 }]}>
      <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="cover" />
    </View>
  )
}

// ---------------------------------------------------------------- full-screen shell

function ProfileShell({ eyebrow, title, subtitle, onClose, header, children }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.shell, { paddingBottom: insets.bottom }]}>
        <SheetHeader title={eyebrow} onBack={onClose} />
        <View style={styles.head}>
          {header}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {subtitle && subtitle !== title ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 12 }}>{children}</ScrollView>
      </View>
    </Modal>
  )
}

function Block({ title, right, children }) {
  return (
    <View style={styles.block}>
      {title || right ? (
        <View style={styles.blockHead}>
          {title ? <Text style={styles.blockTitle}>{title}</Text> : null}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  )
}

function Detail({ label, value, icon: Icon }) {
  const { t } = useLanguage()
  return (
    <View style={styles.detail}>
      <View style={styles.detailLabelRow}>
        {Icon ? <Icon size={12} color={COLORS.slate[400]} /> : null}
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      {typeof value === 'string' || typeof value === 'number' || value == null ? (
        <Text style={styles.detailValue}>{value === '' || value == null ? t('dash.common.notSet') : String(value)}</Text>
      ) : value}
    </View>
  )
}

/** A contact value, or a lock until the server shares it. */
function ContactValue({ value, visible, lockedText }) {
  const { t } = useLanguage()
  if (visible) return <Text style={styles.detailValue}>{value || t('dash.owner.supplierModal.notShared')}</Text>
  return (
    <View style={styles.locked}>
      <Lock size={12} color={COLORS.slate[400]} />
      <Text style={styles.lockedText}>{lockedText || t('dash.common.lockedUntilAccepted')}</Text>
    </View>
  )
}

function Chips({ items, empty }) {
  if (!items.length) return <Text style={styles.muted}>{empty}</Text>
  return (
    <View style={styles.chips}>
      {items.map((item, index) => <View key={`${item}-${index}`} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}
    </View>
  )
}

function Gallery({ images, empty }) {
  if (!images.length) return <Text style={styles.muted}>{empty}</Text>
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {images.map((image, index) => (
        <Pressable key={`${image}-${index}`} onPress={() => Linking.openURL(imageUrl(image))}>
          <Image source={imageSource(image)} style={styles.galleryImage} contentFit="cover" />
        </Pressable>
      ))}
    </ScrollView>
  )
}

// ---------------------------------------------------------------- Find Clients profile

export function ClientProfileSheet({ client, requestSent, sending, onClose, onSendRequest }) {
  const { t, td } = useLanguage()
  if (!client) return null
  const isOwnerProject = Boolean(client.project_title)
  const title = td(isOwnerProject ? client.name : client.company_name || client.name)
  const canViewContact = Boolean(client.can_view_contact)
  const services = listOf(client.services_offered)
  const locations = listOf(client.service_locations)
  const equipment = listOf(client.equipment_owned)
  const documents = listOf(client.documents)
  const gallery = listOf(client.gallery)
  const roleLabel = client.type === 'OWNER' ? t('role.owner') : client.type === 'CONTRACTOR' ? t('role.builder') : client.type || t('role.client')

  return (
    <ProfileShell
      eyebrow={isOwnerProject ? t('dash.common.ownerProject') : t('dash.common.builderProfile')}
      title={title}
      subtitle={isOwnerProject ? td(client.project_title) : `${roleLabel} · ${client.pincode || t('dash.common.notSet')}`}
      onClose={onClose}
      header={<Avatar source={userAvatarSource(client, client.type)} size={52} square />}
    >
      <Pressable
        onPress={() => onSendRequest(client)}
        disabled={sending || requestSent}
        style={[styles.sendButton, requestSent ? styles.sendButtonDone : null, sending ? { opacity: 0.6 } : null]}
      >
        <Send size={15} color={requestSent ? COLORS.brand[800] : '#ffffff'} />
        <Text style={[styles.sendText, requestSent ? styles.sendTextDone : null]}>
          {requestSent ? t('dash.common.requestSent') : sending ? t('dash.common.sending') : t('dash.common.sendRequest')}
        </Text>
      </Pressable>

      {isOwnerProject ? (
        <>
          <View style={styles.details}>
            <Detail label={t('dash.common.project')} value={td(client.project_title)} />
            <Detail label={t('dash.common.construction')} value={constructionTypeLabel(client.construction_type, t)} />
            <Detail label={t('role.owner')} value={td(client.name)} />
            <Detail label={t('dash.common.pincode')} value={client.pincode} />
          </View>
          <Block title={t('dash.supplier.modal.projectSummary')}>
            <Text style={styles.body}>{t('dash.supplier.modal.projectSummaryBody')}</Text>
          </Block>
        </>
      ) : (
        <>
          <View style={styles.details}>
            <Detail label={t('dash.supplier.modal.builderName')} value={td(client.name)} />
            <Detail label={t('dash.supplier.modal.company')} value={td(client.company_name || client.name)} />
            <Detail label={t('dash.common.pincode')} value={client.pincode} />
            <Detail label={t('dash.common.address')} value={td(client.address)} />
            <Detail label={t('dash.msg.experience')} value={t('dash.msg.years', { n: client.experience_years || 0 })} />
            <Detail label={t('dash.common.rating')} value={client.rating || t('dash.common.new')} />
            <Detail label={t('dash.supplier.modal.licenseNumber')} value={client.license_number} />
            <Detail label={t('ps.gstin')} value={client.gstin} />
            <Detail label={t('ps.pan')} value={client.pan} />
            <Detail label={t('dash.supplier.modal.businessType')} value={client.business_type ? optionLabel(t, BUSINESS_TYPE_KEYS, client.business_type) : ''} />
            <Detail label={t('dash.supplier.modal.registrationYear')} value={client.registration_year} />
            <Detail label={t('dash.supplier.modal.teamSize')} value={client.team_size} />
            <Detail label={t('dash.supplier.modal.insurance')} value={client.insurance_available ? t('dash.supplier.modal.available') : ''} />
          </View>

          <Block
            title={t('dash.supplier.modal.contactDetails')}
            right={(
              <View style={[styles.badge, canViewContact ? styles.badgeOn : null]}>
                <Text style={[styles.badgeText, canViewContact ? styles.badgeTextOn : null]}>
                  {canViewContact ? t('dash.supplier.modal.unlocked') : t('dash.supplier.modal.lockedUntilAcceptance')}
                </Text>
              </View>
            )}
          >
            <View style={styles.details}>
              <Detail icon={Phone} label={t('dash.common.phone')} value={<ContactValue value={client.phone} visible={canViewContact} />} />
              <Detail icon={Mail} label={t('dash.common.email')} value={<ContactValue value={client.email} visible={canViewContact} />} />
            </View>
          </Block>

          <Block title={t('dash.supplier.modal.aboutCompany')}>
            <Text style={styles.body}>{client.about ? td(client.about) : t('dash.supplier.modal.noCompanyDescription')}</Text>
            {client.website ? (
              <View style={styles.website}><Globe size={14} color={COLORS.brand[700]} /><Text style={styles.websiteText}>{client.website}</Text></View>
            ) : null}
          </Block>
          <Block title={t('dash.msg.services')}>
            <Chips items={services.map((service) => optionLabel(t, SERVICE_OPTION_KEYS, service))} empty={t('dash.msg.noServices')} />
          </Block>
          <Block title={t('dash.supplier.modal.equipmentOwned')}>
            <Chips items={equipment.map((item) => optionLabel(t, EQUIPMENT_OPTION_KEYS, item))} empty={t('dash.supplier.modal.noEquipment')} />
          </Block>
          <Block title={t('dash.msg.serviceLocations')}>
            <Chips items={locations.map((location) => td(location))} empty={t('dash.msg.noLocations')} />
          </Block>
          <Block title={t('dash.msg.workGallery')}>
            <Gallery images={gallery} empty={t('dash.msg.noGallery')} />
          </Block>
          <Block title={t('dash.common.documents')}>
            <Chips items={documents.map((entry) => optionLabel(t, DOCUMENT_TYPE_KEYS, String(entry).split(':')[0]))} empty={t('dash.common.documentsNone')} />
          </Block>
          <Block title={t('dash.msg.completedProjects')}>
            {client.completed_project_details?.length ? client.completed_project_details.map((project, index) => (
              <Text key={`${project.title}-${index}`} style={styles.projectLine}>
                {`${project.title ? td(project.title) : t('ui.requests.project', { n: index + 1 })}${project.location ? ` - ${td(project.location)}` : ''}`}
              </Text>
            )) : <Text style={styles.muted}>{t('dash.supplier.modal.noCompletedProjects')}</Text>}
          </Block>
        </>
      )}
    </ProfileShell>
  )
}

// ---------------------------------------------------------------- an accepted request's profile

// A stored document entry is "<Type>: <url>", or a bare "<url>" from an older upload.
function documentFileUrl(entry) {
  const text = String(entry || '').trim()
  const separator = text.indexOf(': ')
  if (separator > 0 && !text.startsWith('/') && !text.startsWith('http')) return text.slice(separator + 2).trim()
  return text
}

export function RequestProfileSheet({ details, onClose }) {
  const { t, td } = useLanguage()
  if (!details) return null
  const canViewContact = Boolean(details.can_view_contact)
  // A stored option with a written label uses it; text typed by hand is translated for display.
  const valueLabel = (map, value) => {
    const label = optionLabel(t, map, value)
    return label === value ? td(value) : label
  }
  const profileTitle = td(details.profile_title || details.sender_name) || t('ui.profile')
  const profileName = td(details.profile_name || details.sender_name) || t('ui.shared.user')
  const profileRole = details.profile_role || details.sender_role || 'PROFILE'
  const roleLabel = PROFILE_ROLE_KEYS[profileRole] ? t(PROFILE_ROLE_KEYS[profileRole]) : profileRole
  const isSupplier = profileRole === 'SUPPLIER'
  const services = listOf(details.profile_services || details.profile_categories)
  const locations = listOf(details.profile_locations || details.profile_address || details.project_address)
  const documents = listOf(details.profile_documents)
  const gallery = listOf(details.profile_gallery)
  const products = Array.isArray(details.profile_products) ? details.profile_products : []
  const image = details.profile_image_url || details.profile_logo_url

  const stats = [
    [t('dash.common.rating'), details.profile_rating || '0', Star],
    [t('dash.common.pincode'), details.profile_pincode || details.project_pincode || '-', MapPin],
    [isSupplier ? t('dash.owner.supplierModal.businessType') : t('dash.msg.experience'),
      isSupplier ? (valueLabel(BUSINESS_TYPE_KEYS, details.profile_business_type) || '-') : (details.profile_experience_years ? t('dash.msg.years', { n: details.profile_experience_years }) : '-')],
    [isSupplier ? t('dash.owner.supplierModal.registrationYear') : t('dash.msg.completedProjects'),
      isSupplier ? (details.profile_registration_year || '-') : (details.profile_completed_projects || '-')],
  ]

  return (
    <ProfileShell
      eyebrow={roleLabel}
      title={profileName}
      subtitle={profileTitle}
      onClose={onClose}
      header={<Avatar source={avatarFromPath(image, profileRole)} size={56} square />}
    >
      <View style={[styles.badge, canViewContact ? styles.badgeOn : null, { alignSelf: 'flex-start' }]}>
        <Text style={[styles.badgeText, canViewContact ? styles.badgeTextOn : null]}>
          {canViewContact ? t('dash.msg.contactUnlocked') : t('dash.msg.contactHidden')}
        </Text>
      </View>

      <View style={styles.details}>
        {stats.map(([label, value, Icon]) => (
          <Detail key={label} label={label} value={(
            <View style={styles.statValue}>
              {Icon ? <Icon size={14} color={Icon === Star ? '#f59e0b' : COLORS.brand[700]} /> : null}
              <Text style={styles.statText} numberOfLines={1}>{String(value || '-')}</Text>
            </View>
          )} />
        ))}
        <Detail icon={Phone} label={t('dash.common.phone')} value={<ContactValue value={details.profile_phone || details.sender_phone} visible={canViewContact} />} />
        <Detail icon={Mail} label={t('dash.common.email')} value={<ContactValue value={details.profile_email || details.sender_email} visible={canViewContact} />} />
      </View>

      <Block title={t('dash.msg.about')}>
        <Text style={styles.body}>{td(details.profile_about) || td(details.profile_subtitle) || roleLabel || t('dash.msg.profileAvailable')}</Text>
      </Block>
      <Block title={isSupplier ? t('dash.common.categories') : t('dash.msg.services')}>
        <Chips items={services.map((service) => valueLabel(isSupplier ? SUPPLIER_CATEGORY_KEYS : SERVICE_OPTION_KEYS, service))} empty={t('dash.msg.noServices')} />
      </Block>

      {isSupplier ? (
        <Block title={t('dash.msg.supplierDetails')}>
          <View style={styles.details}>
            <Detail label={t('dash.msg.storeName')} value={profileTitle} />
            <Detail label={t('dash.owner.supplierModal.deliveryLocations')} value={locations.length ? td(locations.join(', ')) : '-'} />
            <Detail label={t('dash.owner.supplierModal.gstin')} value={<ContactValue value={details.profile_gstin} visible={canViewContact} />} />
            <Detail label={t('dash.owner.supplierModal.pan')} value={<ContactValue value={details.profile_pan} visible={canViewContact} />} />
            <Detail label={t('dash.owner.supplierModal.website')} value={<ContactValue value={details.profile_website} visible={canViewContact} />} />
            <Detail label={t('dash.common.address')} value={<ContactValue value={details.profile_address || details.sender_address} visible={canViewContact} />} />
          </View>
        </Block>
      ) : null}

      <Block title={t('dash.msg.serviceLocations')}>
        <Chips items={locations.map((location) => td(location))} empty={t('dash.msg.noLocations')} />
      </Block>
      <Block title={t('dash.msg.certificates')}>
        {documents.length ? documents.map((entry, index) => (
          <Pressable key={`${entry}-${index}`} onPress={() => Linking.openURL(imageUrl(documentFileUrl(entry)))} style={styles.docRow}>
            <FileText size={15} color={COLORS.brand[700]} />
            <Text style={styles.docText}>{t('dash.msg.openDocument', { n: index + 1 })}</Text>
          </Pressable>
        )) : <Text style={styles.muted}>{t('dash.common.documentsNone')}</Text>}
      </Block>
      <Block title={t('dash.msg.workGallery')}>
        <Gallery images={gallery} empty={t('dash.msg.noGallery')} />
      </Block>
      {isSupplier ? (
        <Block title={t('dash.msg.supplierProducts')}>
          {products.length ? products.map((product, index) => (
            <View key={product.id || `${product.name}-${index}`} style={styles.product}>
              {product.image_url ? (
                <Image source={imageSource(product.image_url)} style={styles.productImage} contentFit="cover" />
              ) : (
                <View style={[styles.productImage, styles.productNoImage]}><Text style={styles.chipText}>{t('dash.msg.noImage')}</Text></View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.productName}>{product.name ? td(product.name) : t('dash.owner.supplierModal.productN', { n: index + 1 })}</Text>
                <Text style={styles.productCategory}>{product.category ? valueLabel(SUPPLIER_CATEGORY_KEYS, product.category) : t('dash.msg.categoryNotSet')}</Text>
                <Text style={styles.productPrice}>{`${formatMoney(product.price)} / ${product.unit ? td(product.unit) : t('dash.msg.unit')}`}</Text>
                <Text style={styles.muted}>{`${formatNumber(product.quantity || 0)} ${td(product.unit || '')} ${t('dash.owner.supplierModal.inStock')}`}</Text>
              </View>
            </View>
          )) : <Text style={styles.muted}>{t('dash.msg.noProducts')}</Text>}
        </Block>
      ) : null}
    </ProfileShell>
  )
}

const styles = createStyles((c) => ({
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  statusDot: { height: 7, width: 7, borderRadius: 4 },
  statusText: { flexShrink: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  avatar: { overflow: 'hidden', backgroundColor: c.brandSoft },
  shell: { flex: 1, backgroundColor: c.canvas },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 16, paddingVertical: 14 },
  title: { marginTop: 2, fontSize: 20, lineHeight: 25, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  subtitle: { marginTop: 2, fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  block: { gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  blockTitle: { flexShrink: 1, fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detail: { flexBasis: '47%', flexGrow: 1, gap: 3, borderRadius: 12, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card, paddingHorizontal: 11, paddingVertical: 9 },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textFaint },
  detailValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { flexShrink: 1, fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText: { flexShrink: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  badge: { borderRadius: 999, backgroundColor: c.muted, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOn: { backgroundColor: c.brandSoft },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.textMuted },
  badgeTextOn: { color: c.brandTextStrong },
  body: { fontSize: 13.5, lineHeight: 20, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  muted: { fontSize: 12.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  website: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  websiteText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, backgroundColor: c.brandSoft, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  galleryImage: { height: 110, width: 150, borderRadius: 12, backgroundColor: c.subtle },
  projectLine: { borderRadius: 10, backgroundColor: c.brandSoft, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, borderWidth: 1, borderColor: c.brandBorder, paddingHorizontal: 12, paddingVertical: 11 },
  docText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  product: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.brandBorder, padding: 10 },
  productImage: { height: 72, width: 72, borderRadius: 10 },
  productNoImage: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandSoft },
  productName: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  productCategory: { marginTop: 2, fontSize: 10.5, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.brandText },
  productPrice: { marginTop: 3, fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
  sendButton: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, backgroundColor: '#134127' },
  sendButtonDone: { borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft },
  sendText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  sendTextDone: { color: c.brandTextStrong },
}))
