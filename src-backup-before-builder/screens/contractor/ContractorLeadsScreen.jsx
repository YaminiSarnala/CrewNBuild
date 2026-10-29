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
import { House, Truck, Send, CircleCheckBig, MapPin, Lock, Phone, Mail, Store } from 'lucide-react-native'
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

function listOf(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(typeof item === 'object' && item ? (item.name || item.title || '') : item).trim())
    .filter(Boolean)
}

export default function ContractorLeadsScreen({ navigation }) {
  const dispatch = useDispatch()
  const { t } = useLanguage()
  const stateLabel = (state) => (stateLabelKey[state] ? t(stateLabelKey[state]) : '')
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

  const country = user?.country_of_residence || 'India'
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
          <View className="flex-row gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
            {[
              { id: 'houseowners', label: `${t('dash.contractor.tab.houseownerProjects')} (${openOwnerClients.length})`, icon: House },
              { id: 'suppliers', label: `${t('dash.contractor.tab.supplierRequests')} (${openSupplierClients.length})`, icon: Truck },
            ].map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <Pressable key={id} onPress={() => setActiveTab(id)} className={`h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-brand-700' : ''}`}>
                  <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
                  <Text className={`text-[11px] font-extrabold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</Text>
                </Pressable>
              )
            })}
          </View>
          {showLocation ? (
            <Pressable onPress={() => setLocationOpen(true)} className="mt-2 flex-row items-center gap-1.5 self-start rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5">
              <MapPin size={12} color={COLORS.brand[700]} />
              <Text className="text-[11px] font-extrabold text-brand-800">
                {user?.pincode ? `${t('location.leadsFor', { pincode: user.pincode })} · ${t('location.change')}` : t('location.setLocation')}
              </Text>
            </Pressable>
          ) : null}
        </Section>

        <Section>
          <Notice tone={message?.tone} text={message?.text} />
          {activeTab === 'houseowners' ? (
            <PanelState loading={leads.loading} error={leads.error} empty={!openOwnerClients.length} emptyText={`${t('dash.contractor.noClientsTitle')}\n${t('dash.contractor.noClientsSub')}`}>
              {openOwnerClients.map((project) => {
                const state = requestState(project, 'CONTRACTOR_TO_OWNER')
                const sent = state !== 'none'
                return (
                  <Pressable key={`${project.owner_id}-${project.project_id || project.id}`} onPress={() => setProfileTarget(project)} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                    <View className="flex-row items-center gap-1.5">
                      <CircleCheckBig size={13} color={COLORS.brand[600]} />
                      <Text className="text-[10px] font-extrabold uppercase tracking-wide text-brand-700">{t('dash.contractor.verifiedLead')}</Text>
                    </View>
                    <Text className="mt-1.5 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{project.project_title || project.title || t('dash.contractor.homeownerProject')}</Text>
                    <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{project.owner_name || project.profile_title || t('dash.contractor.homeowner')}</Text>
                    <View className="mt-1 flex-row items-center gap-1">
                      <MapPin size={11} color={COLORS.slate[400]} />
                      <Text className="flex-1 text-[11px] font-semibold text-slate-400" numberOfLines={1}>
                        {project.address || t('dash.owner.estimates.locationNotSet')}{project.pincode ? ` - ${project.pincode}` : ''}
                      </Text>
                    </View>
                    <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
                      <Text className="text-xs font-semibold text-slate-600">{t('dash.contractor.area')}: <Text className="font-extrabold text-graphite">{project.land_area ? t('ui.contractor.areaSqft', { area: project.land_area }) : '—'}</Text></Text>
                      <Text className="text-xs font-semibold text-slate-600">{t('dash.common.budget')}: <Text className="font-extrabold text-graphite">{Number(project.budget || 0) > 0 ? money(project.budget, project.project_country) : t('dash.common.notSet')}</Text></Text>
                      {project.building_type ? <Text className="text-xs font-semibold text-slate-600">{buildingTypeText(project.building_type, t)}</Text> : null}
                    </View>
                    <ActionButton
                      small
                      label={stateLabel(state) || t('dash.common.sendRequest')}
                      icon={Send}
                      tone={sent ? 'outline' : 'primary'}
                      disabled={sent}
                      onPress={() => openSend(project, 'CONTRACTOR_TO_OWNER')}
                      className="mt-3"
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
                return (
                  <Pressable key={`${supplier.owner_id || supplier.user_id || supplier.id}`} onPress={() => openSupplierProfile(supplier)} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                    <Text className="text-[10px] font-extrabold uppercase tracking-wide text-brand-700">{supplier.supplier_category ? optionLabel(t, SUPPLIER_TYPE_KEYS, supplier.supplier_category) : t('role.supplier')}</Text>
                    <Text className="mt-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{name}</Text>
                    {store && store !== name ? (
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <Store size={11} color={COLORS.brand[700]} />
                        <Text className="text-xs font-semibold text-slate-600" numberOfLines={1}>{store}</Text>
                      </View>
                    ) : null}
                    {offerings ? <Text className="mt-1 text-xs font-semibold text-slate-500" numberOfLines={2}>{offerings}</Text> : null}
                    <Text className="mt-1 text-[11px] font-semibold text-slate-400" numberOfLines={1}>
                      {supplier.address || ''}{supplier.pincode ? `${supplier.address ? ' - ' : ''}${supplier.pincode}` : ''}
                    </Text>
                    <ActionButton
                      small
                      label={state === 'sent' ? t('dash.contractor.requestSent') : stateLabel(state) || t('dash.common.sendRequest')}
                      icon={Send}
                      tone={sent ? 'outline' : 'primary'}
                      disabled={sent}
                      onPress={() => openSend(supplier, 'CONTRACTOR_TO_SUPPLIER')}
                      className="mt-3"
                    />
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
          <View className="flex-row gap-2">
            <ActionButton label={t('dash.common.cancel')} tone="outline" onPress={() => setSendTarget(null)} className="flex-1" />
            <ActionButton label={t('dash.common.sendRequest')} icon={Send} busy={sendBusy} onPress={confirmSend} className="flex-1" />
          </View>
        )}
      >
        {sendTarget ? (
          sendDone ? (
            <Text className="text-[13px] font-semibold text-slate-600">
              {t('dash.contractor.requestSentBody', { name: sendTarget.client.store_name || sendTarget.client.owner_name || sendTarget.client.title || t('dash.contractor.thisClient') })}
            </Text>
          ) : (
            <>
              <InfoRow label={t('dash.common.project')} value={sendTarget.client.project_title || sendTarget.client.title || (sendTarget.requestType === 'CONTRACTOR_TO_SUPPLIER' ? t('dash.contractor.supplierProfile') : t('dash.contractor.homeownerProject'))} strong />
              <InfoRow label={t('dash.contractor.recipient')} value={sendTarget.client.store_name || sendTarget.client.owner_name || sendTarget.client.name || sendTarget.client.title} />
              {sendTarget.requestType === 'CONTRACTOR_TO_OWNER' ? (
                <>
                  <InfoRow label={t('dash.contractor.budgetAmount')} value={Number(sendTarget.client.budget || 0) > 0 ? money(sendTarget.client.budget, sendTarget.client.project_country) : t('dash.common.notSet')} />
                  <Text className="mb-1 mt-3 text-xs font-extrabold uppercase text-slate-400">{t('dash.contractor.quotationOptional')}</Text>
                  <TextInput
                    value={sendAmount}
                    onChangeText={(value) => setSendAmount(value.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    placeholder={t('ui.contractor.quotationPlaceholder')}
                    placeholderTextColor={COLORS.slate[400]}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-bold text-graphite"
                  />
                  {Number(sendAmount) > 0 ? <Text className="mt-1 text-xs font-bold text-slate-600">{money(sendAmount, sendTarget.client.project_country)}</Text> : null}
                  <Text className="mt-1.5 text-[11px] font-semibold text-slate-500">{t('mobile.partners.quoteLaterHint')}</Text>
                </>
              ) : null}
              {sendError ? <View className="mt-3"><Notice tone="error" text={sendError} /></View> : null}
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

function ContactRow({ icon: Icon, label, value, canView }) {
  const { t } = useLanguage()
  return (
    <View className="mb-2 rounded-2xl border border-brand-100 bg-white px-3 py-2.5">
      <View className="flex-row items-center gap-1.5">
        <Icon size={12} color={COLORS.brand[700]} />
        <Text className="text-[10px] font-bold uppercase text-slate-400">{label}</Text>
      </View>
      <Text className="mt-1 text-[13px] font-bold text-graphite">{canView ? (value || t('dash.common.notSet')) : '••••••••••'}</Text>
      {!canView ? (
        <View className="mt-1 flex-row items-center gap-1">
          <Lock size={10} color={COLORS.slate[500]} />
          <Text className="text-[10px] font-bold text-slate-500">{t('dash.contractor.visibleAfterAcceptance')}</Text>
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
          <Text className="text-[13px] leading-5 text-slate-600">{client.about || client.description || t('dash.owner.supplierModal.aboutFallback')}</Text>
          <View className="mt-3">
            <InfoRow label={t('dash.owner.supplierModal.businessType')} value={client.business_type ? optionLabel(t, BUSINESS_TYPE_KEYS, client.business_type) : client.business_type} />
            <InfoRow label={t('dash.common.categories')} value={listOf(client.categories || client.material_types).map((category) => optionLabel(t, SUPPLIER_CATEGORY_KEYS, category)).join(', ')} />
            <InfoRow label={t('dash.owner.supplierModal.deliveryLocations')} value={listOf(client.delivery_locations).join(', ')} />
            <InfoRow label={t('dash.common.pincode')} value={client.pincode} />
            <InfoRow label={t('dash.owner.supplierModal.registrationYear')} value={client.registration_year} />
            <InfoRow label={t('dash.common.rating')} value={client.rating || t('dash.common.new')} />
            <InfoRow label={t('dash.contractor.gstLicense')} value={client.gst_number || client.license_number} />
          </View>
          {products.length ? (
            <View className="mt-3">
              <Text className="mb-1 text-xs font-extrabold text-graphite">{t('dash.owner.supplierModal.products')}</Text>
              {products.slice(0, 12).map((product, index) => (
                <View key={product.id || index} className="flex-row justify-between border-b border-slate-100 py-1.5">
                  <Text className="flex-1 text-xs font-semibold text-slate-700" numberOfLines={1}>{product.name || product.product_name || product.title || t('dash.owner.supplierModal.productN', { n: index + 1 })}</Text>
                  <Text className="text-xs font-bold text-graphite">
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
            <Text className="text-[13px] leading-5 text-slate-600">{client.project_description || client.description}</Text>
          ) : null}
          <View className="mt-2">
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
      <Text className="mb-2 mt-4 text-xs font-extrabold text-graphite">{canViewContact ? t('dash.contractor.contactUnlocked') : t('dash.contractor.contactLocked')}</Text>
      <ContactRow icon={Phone} label={t('ps.phoneShort')} value={client.phone} canView={canViewContact} />
      <ContactRow icon={Mail} label={t('ps.email')} value={client.email} canView={canViewContact} />
      {supplier ? <ContactRow icon={MapPin} label={t('ps.address')} value={client.address} canView={canViewContact} /> : null}
      <ActionButton
        label={canViewContact ? t('dash.contractor.requestAccepted') : sent ? (state === 'sent' ? t('dash.contractor.requestSent') : stateLabel(state)) : t('dash.common.sendRequest')}
        icon={Send}
        tone={sent || canViewContact ? 'outline' : 'primary'}
        disabled={sent || canViewContact}
        onPress={onSend}
        className="mt-2"
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
      <View className="flex-row gap-2">
        <TextInput
          value={pincode}
          onChangeText={(value) => { setPincode(value.replace(/\D/g, '')); setAreas([]); setAreaDetails(null); setSelectedArea('') }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder={t('ui.shared.sixDigitPincode')}
          placeholderTextColor={COLORS.slate[400]}
          className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-bold text-graphite"
        />
        <ActionButton label={t('ce.find')} busy={busy && !areas.length} onPress={lookup} />
      </View>
      {areas.length ? (
        <View className="mt-3">
          <Text className="mb-1.5 text-xs font-bold text-slate-600">{t('location.selectBranch')}</Text>
          <SegmentTabs dense tabs={areas.map((area) => ({ id: area.name, label: area.name }))} active={selectedArea} onChange={setSelectedArea} />
        </View>
      ) : null}
      {error ? <View className="mt-3"><Notice tone="error" text={error} /></View> : null}
    </SheetModal>
  )
}