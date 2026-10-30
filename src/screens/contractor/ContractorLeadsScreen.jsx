// Port of web contractorFindClients.jsx (ContractorFindClientsSection,
// ClientProfileDrawer, SendRequestDrawer) and the lead rules in
// ContractorDashboard.jsx.
//
//   - Leads come from GET /contractors/find-clients (houseowner projects and
//     suppliers, told apart by client_type). If that feed carries no suppliers,
//     the Suppliers tab falls back to GET /suppliers/nearby (the previous
//     mobile source) so nothing that used to show disappears.
//   - A lead with a live request (pending or accepted, either direction) is not
//     listed: it lives on the Requests board. Declined / withdrawn leads come
//     back so a new request can be sent. Status comes from the stored requests
//     (GET /project-requests/incoming), matched by id — never by title.
//   - Sending a request to an owner may carry an optional quotation
//     (POST /project-requests/send { receiver_id, project_id, request_type, quotation_amount? }).
//   - "Leads for <pincode> · Change" saves a new location through
//     GET /locations/pincode/{pin} + PATCH /auth/location, then reloads the leads.
// Strings come from the web translation keys (mobile.partners.* for mobile-only text).
import { useEffect, useState } from 'react'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useBuilderInbox } from '../../components/builder/BuilderInbox'
import { View, Text, Pressable, TextInput } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { House, Truck, Send, MapPin, Lock, Phone, Mail, Store, FileText, BrickWall, Tractor, HardHat } from 'lucide-react-native'
import { Image } from 'expo-image'
import { avatarFromPath } from '../../utils/avatars'
import DashboardShell, { PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchNearbyProjects, fetchNearbySuppliers } from '../../api/projects'
import { fetchIncomingRequests, sendProjectRequest } from '../../api/requests'
import { fetchSupplierProfile } from '../../api/profiles'
import { lookupPincodeArea, updateUserLocation } from '../../api/location'
import { mergeUser } from '../../store/authSlice'
import {
  ActionButton, InfoRow, Notice, Section, SegmentTabs, SheetModal,
} from '../../components/builder/BuilderUi'
import {
  apiErrorText, asList, buildingTypeText, clientRequestState, findClientRequest, money,
} from '../../utils/builderHelpers'
import { constructionTypeLabel } from '../../utils/roleLabels'
import { COLORS } from '../../theme/tokens'
import { userCountry } from '../../utils/countryConfig'
import { createStyles } from '../../theme/createStyles'
import { ink, line, soft } from '../../theme/tint'
import { useLanguage } from '../../i18n/LanguageContext'
import { BUSINESS_TYPE_KEYS, FLOOR_TYPE_KEYS, SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../i18n/optionKeys'

const receiverOf = (client, requestType) => (
  requestType === 'CONTRACTOR_TO_OWNER'
    ? client.owner_id
    : (client.owner_id || client.user_id || client.id)
)

const keyOf = (client, requestType) => `${requestType}-${receiverOf(client, requestType)}-${client.project_id || 'profile'}`

// Translation keys for each request state (web contractorFindClients.jsx).
const stateLabelKey = {
  accepted: 'ui.status.accepted',
  pending: 'ui.status.pending',
  sent: 'dash.contractor.requestSent',
  rejected: 'ui.status.rejected',
  withdrawn: 'dash.common.sendRequest',
  none: 'dash.common.sendRequest',
}

// Stored supplier type -> display key (web optionKeys SUPPLIER_TYPE_KEYS).
const SUPPLIER_TYPE_KEYS = {
  'Material Supplier': 'opt.supplierType.material',
  'Labor Supplier': 'opt.supplierType.labor',
  'Equipment Supplier': 'opt.supplierType.equipment',
}
// Card backgrounds, cycled by index (web LEAD_TINTS).
const LEAD_TINTS = [
    { bg: '#f0fdf4', border: '#d1fae5', accent: '#10b981' },
  { bg: '#ffffff', border: '#e2e8f0', accent: '#64748b' },
  { bg: '#fff7ed', border: '#fed7aa', accent: '#f97316' },
  { bg: '#fdf2f8', border: '#fbcfe8', accent: '#ec4899' },
  { bg: '#f0f9ff', border: '#bae6fd', accent: '#0ea5e9' },
  { bg: '#f0fdfa', border: '#99f6e4', accent: '#14b8a6' },
]

// Supplier card top band by supplier_category (web contractorFindClients).
const SUPPLIER_BANDS = {
  'Material Supplier': { icon: BrickWall, bg: '#ecfdf5', fg: '#047857' },
  'Equipment Supplier': { icon: Tractor, bg: '#f5f3ff', fg: '#6d28d9' },
  'Labor Supplier': { icon: HardHat, bg: '#f0f9ff', fg: '#0369a1' },
  other: { icon: Truck, bg: '#f8fafc', fg: '#475569' },
}
function listOf(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(typeof item === 'object' && item ? (item.name || item.title || '') : item).trim())
    .filter(Boolean)
}

export default function ContractorLeadsScreen({ navigation }) {
  const dispatch = useDispatch()
  const { t } = useLanguage()
  const stateLabel = (state) => (stateLabelKey[state] ? t(stateLabelKey[state]) : '')
  // Send-button label by priority, as on the web.
  const leadButtonLabel = (state) => (state === 'rejected' ? t('ui.status.rejected')
    : state === 'pending' ? t('ui.status.pending')
      : state !== 'none' ? t('dash.contractor.status.proposalSent')
        : t('dash.common.sendRequest'))
          const user = useSelector((state) => state.auth.user)
  const [activeTab, setActiveTab] = useState('houseowners')
  const [refreshing, setRefreshing] = useState(false)
  const [sentKeys, setSentKeys] = useState({})
  const [message, setMessage] = useState(null)
  const [sendTarget, setSendTarget] = useState(null) // { client, requestType }
  const [sendAmount, setSendAmount] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendDone, setSendDone] = useState(false)
  const [profileTarget, setProfileTarget] = useState(null)
  const [supplierProfileNote, setSupplierProfileNote] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)

  const country = userCountry(user)
  const leads = useAsyncData(() => fetchNearbyProjects(country), [country, user?.pincode])
  const requests = useAsyncData(fetchIncomingRequests, [])
  useLiveRefresh(() => { leads.reload(); requests.reload() })
  // Opening Find Clients marks the nearby leads as seen (web markNearbyClientsSeen).
  const { markClientsSeen, unseenClients } = useBuilderInbox()
  useEffect(() => {
    if (leads.data && unseenClients > 0) markClientsSeen()
  }, [leads.data, unseenClients, markClientsSeen])
  const nearbySuppliers = useAsyncData(
    () => fetchNearbySuppliers(user?.pincode, country).catch(() => []),
    [user?.pincode, country],
  )

  const leadList = asList(leads.data, 'projects', 'items')
  const requestList = asList(requests.data, 'items', 'requests')
  const ownerClients = leadList.filter((client) => client.client_type !== 'SUPPLIER')
  const feedSuppliers = leadList.filter((client) => client.client_type === 'SUPPLIER')
  const supplierClients = feedSuppliers.length
    ? feedSuppliers
    : asList(nearbySuppliers.data, 'suppliers', 'items').map((supplier) => ({ ...supplier, client_type: 'SUPPLIER' }))

  // The stored state, else the optimistic "sent" for the moment before the refresh lands.
  const requestState = (client, requestType) => {
    const stored = clientRequestState(requestList, client)
    // Declined (owner leads) or withdrawn requests reopen the lead.
    const reopened = stored === 'withdrawn' || (stored === 'rejected' && client.client_type !== 'SUPPLIER')
    if (stored !== 'none' && !reopened) return stored
    if (sentKeys[keyOf(client, requestType)]) return 'sent'
    if (!client.project_id && client.can_view_contact && client.client_type !== 'SUPPLIER') return 'accepted'
    return 'none'
  }

  // A pending or accepted request (either direction) keeps the lead off this list.
  const openOwnerClients = ownerClients.filter((client) => {
    if (sentKeys[keyOf(client, 'CONTRACTOR_TO_OWNER')]) {
      const stored = findClientRequest(requestList, client)
      if (!stored || !['rejected', 'withdrawn'].includes(stored.status)) return false
    }
    const stored = findClientRequest(requestList, client)
    return !stored || ['rejected', 'withdrawn'].includes(stored.status)
  })

  const openSupplierClients = supplierClients.filter((supplier) => requestState(supplier, 'CONTRACTOR_TO_SUPPLIER') !== 'accepted')

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([leads.reload(), requests.reload(), nearbySuppliers.reload()])
    } finally {
      setRefreshing(false)
    }
  }

  function openSend(client, requestType) {
    setSendTarget({ client, requestType })
    setSendAmount('')
    setSendError('')
    setSendDone(false)
  }

  async function confirmSend() {
    if (!sendTarget) return
    const { client, requestType } = sendTarget
    const receiverId = receiverOf(client, requestType)
    if (!receiverId) {
      setSendError(t('mobile.partners.missingRecipient'))
      return
    }
    setSendBusy(true)
    setSendError('')
    const key = keyOf(client, requestType)
    try {
      const details = { receiver_id: receiverId, project_id: client.project_id || null, request_type: requestType }
      const amount = Number(String(sendAmount).replace(/,/g, '').trim())
      if (requestType === 'CONTRACTOR_TO_OWNER' && amount > 0) details.quotation_amount = amount
      await sendProjectRequest(details)
      setSentKeys((current) => ({ ...current, [key]: true }))
      setSendDone(true)
      setMessage({ tone: 'success', text: t('dash.contractor.requestSentBody', { name: client.store_name || client.owner_name || client.title || t('dash.clientFallback') }) })
      requests.reload()
    } catch (error) {
      const detail = apiErrorText(error, t('dash.err.sendRequest'))
      setSendError(detail)
      if (detail === 'Request already sent') {
        setSentKeys((current) => ({ ...current, [key]: true }))
        requests.reload()
      }
    } finally {
      setSendBusy(false)
    }
  }

  async function openSupplierProfile(supplier) {
    setProfileTarget({ ...supplier, client_type: 'SUPPLIER' })
    const supplierUserId = supplier.user_id || supplier.owner_id || supplier.id
    if (!supplierUserId) {
      setSupplierProfileNote(t('dash.err.loadSupplierProfileShort'))
      return
    }
    setSupplierProfileNote(t('dash.msg.loadingSupplierProfile'))
    try {
      const profile = await fetchSupplierProfile(supplierUserId)
      setProfileTarget({
        ...supplier,
        ...profile,
        client_type: 'SUPPLIER',
        owner_id: supplier.owner_id || profile.user_id || supplierUserId,
        user_id: profile.user_id || supplier.user_id || supplierUserId,
      })
      setSupplierProfileNote('')
    } catch (error) {
      setSupplierProfileNote(apiErrorText(error, t('dash.err.loadSupplierProfileShort')))
    }
  }

  const showLocation = String(country).toLowerCase() === 'india'

  return (
    <>
      <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
        <Section>
                   {/* Underlined tabs, as on the web. */}
          <View style={styles.view4}>
            {[
              { id: 'houseowners', label: `${t('dash.contractor.tab.houseownerProjects')} (${openOwnerClients.length})`, icon: House },
              { id: 'suppliers', label: `${t('dash.contractor.tab.supplierRequests')} (${openSupplierClients.length})`, icon: Truck },
            ].map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <Pressable key={id} onPress={() => setActiveTab(id)} style={[styles.pressable6, { borderBottomWidth: 2.5, borderBottomColor: active ? COLORS.brand[800] : 'transparent' }]}>
                  <Icon size={14} color={active ? COLORS.brand[900] : COLORS.slate[400]} />
                  <Text style={[styles.text10, active ? styles.text11 : styles.text12]}>{label}</Text>
                </Pressable>
              )
            })}
          </View>
          {showLocation ? (
            <Pressable onPress={() => setLocationOpen(true)} style={styles.pressable7}>
              <MapPin size={12} color={COLORS.brand[700]} />
              <Text style={styles.text13}>
                {user?.pincode ? `${t('location.leadsFor', { pincode: user.pincode })} · ${t('location.change')}` : t('location.setLocation')}
              </Text>
            </Pressable>
          ) : null}
        </Section>

        <Section>
          <Notice tone={message?.tone} text={message?.text} />
          {activeTab === 'houseowners' ? (
            <PanelState loading={leads.loading} error={leads.error} empty={!openOwnerClients.length} emptyText={`${t('dash.contractor.noClientsTitle')}\n${t('dash.contractor.noClientsSub')}`}>
                           {openOwnerClients.map((project, index) => {
                const state = requestState(project, 'CONTRACTOR_TO_OWNER')
                const sent = state !== 'none'
                const tint = LEAD_TINTS[index % LEAD_TINTS.length]
                return (
                  <Pressable key={`${project.owner_id}-${project.project_id || project.id}`} onPress={() => setProfileTarget(project)} style={[styles.pressable8, { backgroundColor: soft(tint.bg, tint.accent), borderColor: line(tint.border, tint.accent) }]}>
                    <View style={styles.view5}>
                      <Image source={avatarFromPath(project.owner_profile_image_url, 'OWNER')} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                      <View style={styles.actionButton}>
                        <Text style={styles.text14} numberOfLines={1}>{project.owner_name || project.profile_title || t('dash.contractor.homeowner')}</Text>
                        <Text style={styles.text15} numberOfLines={1}>{project.project_title || project.title || t('dash.contractor.homeownerProject')}</Text>
                      </View>
                      {project.building_type ? (
                        <View style={styles.view6}>
                          <Text style={styles.text16}>{buildingTypeText(project.building_type, t)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.view7}>
                      <View>
                        <Text style={styles.text17}>{project.land_area ? Number(project.land_area).toLocaleString('en-IN') : '—'}</Text>
                        <Text style={styles.text18}>{t('dash.contractor.sqftUnit')}</Text>
                      </View>
                      <View style={styles.view8} />
                      <View style={styles.view9}>
                        <Text style={styles.text18}>{t('dash.contractor.budgetAmount')}</Text>
                        <Text style={styles.text19} numberOfLines={1}>{Number(project.budget || 0) > 0 ? money(project.budget, project.project_country) : '—'}</Text>
                      </View>
                    </View>
                    <View style={styles.view10}>
                      <MapPin size={13} color="#047857" />
                      <Text style={styles.text20} numberOfLines={2}>
                        {project.address || t('dash.owner.estimates.locationNotSet')}{project.pincode ? ` - ${project.pincode}` : ''}
                      </Text>
                    </View>
                    <ActionButton
                      label={leadButtonLabel(state)}
                      icon={Send}
                      tone={sent ? 'outline' : 'primary'}
                      disabled={sent}
                      onPress={() => openSend(project, 'CONTRACTOR_TO_OWNER')}
                      style={styles.view11}
                    />
                  </Pressable>
                )
              })}
            </PanelState>
          ) : (
            <PanelState
              loading={leads.loading || (nearbySuppliers.loading && !feedSuppliers.length)}
              error={leads.error && !supplierClients.length ? leads.error : ''}
              empty={!openSupplierClients.length}
              emptyText={`${t('dash.owner.suppliers.emptyTitle')}\n${t('dash.contractor.suppliersEmpty')}`}
            >
                           {openSupplierClients.map((supplier) => {
                const state = requestState(supplier, 'CONTRACTOR_TO_SUPPLIER')
                const sent = state !== 'none'
                const name = supplier.name || supplier.store_name || supplier.business_name || supplier.title || t('dash.common.supplier')
                const store = supplier.store_name || supplier.business_name || supplier.title || ''
                const offerings = listOf(supplier.categories || supplier.material_types).map((category) => optionLabel(t, SUPPLIER_CATEGORY_KEYS, category)).join(', ')
                const band = SUPPLIER_BANDS[supplier.supplier_category] || SUPPLIER_BANDS.other
                const BandIcon = band.icon
                return (
                  <Pressable key={`${supplier.owner_id || supplier.user_id || supplier.id}`} onPress={() => openSupplierProfile(supplier)} style={styles.pressable9}>
                    <View style={[styles.view12, { backgroundColor: soft(band.bg, band.fg) }]}>
                      <View style={styles.view13}>
                        <BandIcon size={13} color={ink(band.fg)} />
                        <Text style={[styles.text21, { color: band.fg }]}>{supplier.supplier_category ? optionLabel(t, SUPPLIER_TYPE_KEYS, supplier.supplier_category) : t('role.supplier')}</Text>
                      </View>
                      {supplier.pincode ? (
                        <View style={styles.view14}>
                          <MapPin size={11} color={ink(band.fg)} />
                          <Text style={[styles.text22, { color: ink(band.fg) }]}>{supplier.pincode}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.view15}>
                      <View style={styles.view16}>
                        <Image source={avatarFromPath(supplier.cover_image_url, 'SUPPLIER')} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                        <View style={styles.actionButton}>
                          <Text style={styles.text14} numberOfLines={1}>{name}</Text>
                          {store && store !== name ? (
                            <View style={styles.view17}>
                              <Store size={11} color={COLORS.brand[700]} />
                              <Text style={styles.text23} numberOfLines={1}>{store}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {offerings ? (
                        <View style={styles.view18}>
                          <FileText size={13} color={COLORS.slate[500]} />
                          <Text style={styles.text24} numberOfLines={2}>{offerings}</Text>
                        </View>
                      ) : null}
                      <ActionButton
                        label={state === 'sent' ? t('dash.contractor.requestSent') : leadButtonLabel(state)}
                        icon={Send}
                        tone={sent ? 'outline' : 'primary'}
                        disabled={sent}
                        onPress={() => openSend(supplier, 'CONTRACTOR_TO_SUPPLIER')}
                        style={styles.view11}
                      />
                    </View>
                  </Pressable>
                )
              })}
            </PanelState>
          )}
        </Section>
      </DashboardShell>

      {/* Send request, with an optional quotation for an owner lead. */}
      <SheetModal
        visible={!!sendTarget}
        title={sendDone ? t('dash.contractor.requestSent') : t('dash.common.sendRequest')}
        subtitle={sendTarget ? (sendTarget.client.project_title || sendTarget.client.title || sendTarget.client.store_name || '') : ''}
        onClose={() => setSendTarget(null)}
        footer={sendDone ? (
          <ActionButton label={t('dash.contractor.done')} onPress={() => setSendTarget(null)} />
        ) : (
          <View style={styles.view19}>
            <ActionButton label={t('dash.common.cancel')} tone="outline" onPress={() => setSendTarget(null)} style={styles.actionButton} />
            <ActionButton label={t('dash.common.sendRequest')} icon={Send} busy={sendBusy} onPress={confirmSend} style={styles.actionButton} />
          </View>
        )}
      >
        {sendTarget ? (
          sendDone ? (
            <Text style={styles.text25}>
              {t('dash.contractor.requestSentBody', { name: sendTarget.client.store_name || sendTarget.client.owner_name || sendTarget.client.title || t('dash.contractor.thisClient') })}
            </Text>
          ) : (
            <>
              <InfoRow label={t('dash.common.project')} value={sendTarget.client.project_title || sendTarget.client.title || (sendTarget.requestType === 'CONTRACTOR_TO_SUPPLIER' ? t('dash.contractor.supplierProfile') : t('dash.contractor.homeownerProject'))} strong />
              <InfoRow label={t('dash.contractor.recipient')} value={sendTarget.client.store_name || sendTarget.client.owner_name || sendTarget.client.name || sendTarget.client.title} />
              {sendTarget.requestType === 'CONTRACTOR_TO_OWNER' ? (
                <>
                  <InfoRow label={t('dash.contractor.budgetAmount')} value={Number(sendTarget.client.budget || 0) > 0 ? money(sendTarget.client.budget, sendTarget.client.project_country) : t('dash.common.notSet')} />
                  <Text style={styles.text26}>{t('dash.contractor.quotationOptional')}</Text>
                  <TextInput
                    value={sendAmount}
                    onChangeText={(value) => setSendAmount(value.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    placeholder={t('ui.contractor.quotationPlaceholder')}
                    placeholderTextColor={COLORS.slate[400]}
                    style={styles.textInput}
                  />
                  {Number(sendAmount) > 0 ? <Text style={styles.text27}>{money(sendAmount, sendTarget.client.project_country)}</Text> : null}
                  <Text style={styles.text28}>{t('mobile.partners.quoteLaterHint')}</Text>
                </>
              ) : null}
              {sendError ? <View style={styles.view11}><Notice tone="error" text={sendError} /></View> : null}
            </>
          )
        ) : null}
      </SheetModal>

      {/* Client / supplier details */}
      <SheetModal
        visible={!!profileTarget}
        tall
        title={profileTarget?.client_type === 'SUPPLIER'
          ? (profileTarget?.store_name || profileTarget?.business_name || profileTarget?.name || t('dash.common.supplier'))
          : (profileTarget?.project_title || profileTarget?.title || t('dash.contractor.homeownerProject'))}
        subtitle={t('dash.contractor.clientDetails')}
        onClose={() => { setProfileTarget(null); setSupplierProfileNote('') }}
      >
        {profileTarget ? (
          <ClientDetails
            client={profileTarget}
            stateLabel={stateLabel}
            state={requestState(profileTarget, profileTarget.client_type === 'SUPPLIER' ? 'CONTRACTOR_TO_SUPPLIER' : 'CONTRACTOR_TO_OWNER')}
            note={supplierProfileNote}
            onSend={() => {
              const requestType = profileTarget.client_type === 'SUPPLIER' ? 'CONTRACTOR_TO_SUPPLIER' : 'CONTRACTOR_TO_OWNER'
              const target = profileTarget
              setProfileTarget(null)
              openSend(target, requestType)
            }}
          />
        ) : null}
      </SheetModal>

      <LocationSheet
        visible={locationOpen}
        currentPincode={user?.pincode || ''}
        onClose={() => setLocationOpen(false)}
        onSaved={(updatedUser) => {
          dispatch(mergeUser(updatedUser?.user || updatedUser || {}))
          setLocationOpen(false)
          setActiveTab('houseowners')
          setMessage({ tone: 'success', text: t('mobile.partners.locationSaved') })
        }}
      />
    </>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view2: { flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.brandText },
  text2: { marginTop: 5.25, fontSize: 15, fontWeight: '800', color: c.text },
  text3: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  text4: { marginTop: 3.5, fontSize: 11, fontWeight: '600', color: c.textFaint },
  pressable: { marginTop: 10.5, height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 9999 },
  pressable2: { backgroundColor: c.brandSoft },
  pressable3: { backgroundColor: '#1a5038' },
  pressable4: { opacity: 0.6 },
  text5: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  text6: { color: c.brandText },
  text7: { color: '#ffffff' },
  view3: { marginBottom: 14, flexDirection: 'row', gap: 5.25, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 5.25 },
  pressable5: { height: 35, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 10.5 },
  text8: { fontSize: 11, fontWeight: '800' },
  text9: { color: c.textMuted },
  view4: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border },
  pressable6: { marginRight: 14, flexDirection: 'row', alignItems: 'center', gap: 5.25, paddingBottom: 8.75, paddingTop: 3.5 },
  text10: { fontSize: 12.5, fontWeight: '800' },
  text11: { color: c.brandTextDeep },
  text12: { color: c.textMuted },
  pressable7: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5.25, alignSelf: 'flex-start', borderRadius: 9999, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  text13: { fontSize: 11, fontWeight: '800', color: c.brandTextStrong },
  pressable8: { marginBottom: 10.5, borderRadius: 24, borderWidth: 1, padding: 14 },
  view5: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5 },
  actionButton: { flex: 1 },
  text14: { fontSize: 15, fontWeight: '800', color: c.text },
  text15: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view6: { borderRadius: 9999, borderWidth: 1, borderColor: c.emeraldBorderSoft, backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text16: { fontSize: 10, fontWeight: '800', color: c.emeraldTextStrong },
  view7: { marginTop: 10.5, flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  text17: { fontSize: 16, fontWeight: '800', color: c.text },
  text18: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  view8: { height: 31.5, width: 1, backgroundColor: c.mutedStrong },
  view9: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingHorizontal: 10.5, paddingVertical: 7 },
  text19: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '800', color: c.text },
  view10: { marginTop: 10.5, flexDirection: 'row', alignItems: 'center', gap: 5.25, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 10.5 },
  text20: { flex: 1, fontSize: 12, fontWeight: '600', color: c.textSecondary },
  view11: { marginTop: 10.5 },
  pressable9: { marginBottom: 10.5, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  view12: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7 },
  view13: { flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text21: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  view14: { flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text22: { fontSize: 11, fontWeight: '700' },
  view15: { padding: 14 },
  view16: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  view17: { marginTop: 1.75, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text23: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  view18: { marginTop: 10.5, flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  text24: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  view19: { flexDirection: 'row', gap: 7 },
  text25: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  text26: { marginBottom: 3.5, marginTop: 10.5, fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase', color: c.textFaint },
  textInput: { height: 38.5, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '700', color: c.text },
  text27: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  text28: { marginTop: 5.25, fontSize: 11, fontWeight: '600', color: c.textMuted },
  view20: { marginBottom: 7, borderRadius: 16, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text29: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: c.textFaint },
  text30: { marginTop: 3.5, fontSize: 13, fontWeight: '700', color: c.text },
  view21: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text31: { fontSize: 10, fontWeight: '700', color: c.textMuted },
  text32: { fontSize: 13, lineHeight: 17.5, color: c.textSecondary },
  text33: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.text },
  view22: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 5.25 },
  text34: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSoft },
  text35: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.text },
  actionButton2: { marginTop: 7 },
  text36: { marginBottom: 7, marginTop: 14, fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.text },
  textInput2: { height: 38.5, flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 15, fontWeight: '700', color: c.text },
  text37: { marginBottom: 5.25, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
}))
function ContactRow({ icon: Icon, label, value, canView }) {
  const { t } = useLanguage()
  return (
    <View style={styles.view20}>
      <View style={styles.view13}>
        <Icon size={12} color={COLORS.brand[700]} />
        <Text style={styles.text29}>{label}</Text>
      </View>
      <Text style={styles.text30}>{canView ? (value || t('dash.common.notSet')) : '••••••••••'}</Text>
      {!canView ? (
        <View style={styles.view21}>
          <Lock size={10} color={COLORS.slate[500]} />
          <Text style={styles.text31}>{t('dash.contractor.visibleAfterAcceptance')}</Text>
        </View>
      ) : null}
    </View>
  )
}

function ClientDetails({ client, state, stateLabel, note, onSend }) {
  const { t } = useLanguage()
  const supplier = client.client_type === 'SUPPLIER'
  const canViewContact = state === 'accepted' || Boolean(client.can_view_contact)
  const sent = state !== 'none'
  const products = Array.isArray(client.profile_products) && client.profile_products.length
    ? client.profile_products
    : (Array.isArray(client.products) ? client.products : [])
  return (
    <View>
      {note ? <Notice tone="info" text={note} /> : null}
      {supplier ? (
        <>
          <Text style={styles.text32}>{client.about || client.description || t('dash.owner.supplierModal.aboutFallback')}</Text>
          <View style={styles.view11}>
            <InfoRow label={t('dash.owner.supplierModal.businessType')} value={client.business_type ? optionLabel(t, BUSINESS_TYPE_KEYS, client.business_type) : client.business_type} />
            <InfoRow label={t('dash.common.categories')} value={listOf(client.categories || client.material_types).map((category) => optionLabel(t, SUPPLIER_CATEGORY_KEYS, category)).join(', ')} />
            <InfoRow label={t('dash.owner.supplierModal.deliveryLocations')} value={listOf(client.delivery_locations).join(', ')} />
            <InfoRow label={t('dash.common.pincode')} value={client.pincode} />
            <InfoRow label={t('dash.owner.supplierModal.registrationYear')} value={client.registration_year} />
            <InfoRow label={t('dash.common.rating')} value={client.rating || t('dash.common.new')} />
            <InfoRow label={t('dash.contractor.gstLicense')} value={client.gst_number || client.license_number} />
          </View>
          {products.length ? (
            <View style={styles.view11}>
              <Text style={styles.text33}>{t('dash.owner.supplierModal.products')}</Text>
              {products.slice(0, 12).map((product, index) => (
                <View key={product.id || index} style={styles.view22}>
                  <Text style={styles.text34} numberOfLines={1}>{product.name || product.product_name || product.title || t('dash.owner.supplierModal.productN', { n: index + 1 })}</Text>
                  <Text style={styles.text35}>
                    {Number(product.price || product.unit_price || 0) > 0 ? money(product.price || product.unit_price) : t('dash.owner.supplierModal.priceNotSet')}
                    {product.unit ? ` / ${product.unit}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {client.project_description || client.description ? (
            <Text style={styles.text32}>{client.project_description || client.description}</Text>
          ) : null}
          <View style={styles.actionButton2}>
            <InfoRow label={t('dash.contractor.homeowner')} value={client.owner_name || client.profile_title} strong />
            <InfoRow label={t('dash.common.location')} value={`${client.address || ''}${client.pincode ? ` - ${client.pincode}` : ''}`} />
            <InfoRow label={t('cpp.landArea')} value={client.land_area ? t('cpp.sqFt', { area: client.land_area }) : ''} />
            <InfoRow label={t('cpp.budget')} value={Number(client.budget || 0) > 0 ? money(client.budget, client.project_country) : ''} />
            <InfoRow label={t('ps.owner.buildingType')} value={buildingTypeText(client.building_type, t)} />
            <InfoRow label={t('ps.owner.constructionType')} value={constructionTypeLabel(client.construction_type, t)} />
            <InfoRow label={t('ps.owner.floors')} value={client.floors ? optionLabel(t, FLOOR_TYPE_KEYS, client.floors) : client.floors} />
            <InfoRow label={t('ps.owner.startTimeline')} value={client.start_timeline} />
          </View>
        </>
      )}
      <Text style={styles.text36}>{canViewContact ? t('dash.contractor.contactUnlocked') : t('dash.contractor.contactLocked')}</Text>
      <ContactRow icon={Phone} label={t('ps.phoneShort')} value={client.phone} canView={canViewContact} />
      <ContactRow icon={Mail} label={t('ps.email')} value={client.email} canView={canViewContact} />
      {supplier ? <ContactRow icon={MapPin} label={t('ps.address')} value={client.address} canView={canViewContact} /> : null}
      <ActionButton
        label={canViewContact ? t('dash.contractor.requestAccepted') : sent ? (state === 'sent' ? t('dash.contractor.requestSent') : stateLabel(state)) : t('dash.common.sendRequest')}
        icon={Send}
        tone={sent || canViewContact ? 'outline' : 'primary'}
        disabled={sent || canViewContact}
        onPress={onSend}
        style={styles.actionButton2}
      />
    </View>
  )
}

/** Change the pincode the leads are matched on (web LocationLeadsPrompt). */
function LocationSheet({ visible, currentPincode, onClose, onSaved }) {
  const { t } = useLanguage()
  const [pincode, setPincode] = useState(currentPincode)
  const [areas, setAreas] = useState([])
  const [areaDetails, setAreaDetails] = useState(null)
  const [selectedArea, setSelectedArea] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (visible) {
      setPincode(currentPincode)
      setAreas([])
      setAreaDetails(null)
      setSelectedArea('')
      setError('')
    }
  }, [visible, currentPincode])

  async function lookup() {
    const value = pincode.trim()
    if (!/^\d{6}$/.test(value)) { setError(t('location.invalid')); return }
    setBusy(true)
    setError('')
    try {
      const data = await lookupPincodeArea(value)
      const branches = Array.isArray(data?.post_offices) ? data.post_offices : []
      setAreaDetails(data)
      setAreas(branches)
      setSelectedArea(branches.length === 1 ? branches[0].name : '')
      if (!branches.length) setError(t('location.notFound'))
    } catch (failure) {
      setError(apiErrorText(failure, t('location.unknown')))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!areaDetails || !selectedArea) { setError(t('location.prompt.selectBranch')); return }
    setBusy(true)
    setError('')
    try {
      const updatedUser = await updateUserLocation(String(areaDetails.pincode || pincode).trim(), selectedArea)
      onSaved(updatedUser)
    } catch (failure) {
      setError(apiErrorText(failure, t('location.prompt.saveFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetModal
      visible={visible}
      title={t('location.setLocation')}
      subtitle={t('location.prompt.sub')}
      onClose={onClose}
      footer={<ActionButton label={t('location.prompt.save')} busy={busy} disabled={!selectedArea} onPress={save} />}
    >
      <View style={styles.view19}>
        <TextInput
          value={pincode}
          onChangeText={(value) => { setPincode(value.replace(/\D/g, '')); setAreas([]); setAreaDetails(null); setSelectedArea('') }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder={t('ui.shared.sixDigitPincode')}
          placeholderTextColor={COLORS.slate[400]}
          style={styles.textInput2}
        />
        <ActionButton label={t('ce.find')} busy={busy && !areas.length} onPress={lookup} />
      </View>
      {areas.length ? (
        <View style={styles.view11}>
          <Text style={styles.text37}>{t('location.selectBranch')}</Text>
          <SegmentTabs dense tabs={areas.map((area) => ({ id: area.name, label: area.name }))} active={selectedArea} onChange={setSelectedArea} />
        </View>
      ) : null}
      {error ? <View style={styles.view11}><Notice tone="error" text={error} /></View> : null}
    </SheetModal>
  )
}
