// Port of web contractorSections.ContractorRequestsSection +
// contractorRequestViews.ContractorRequestsBoard.
//
// House Owner and Supplier requests are the same stored rows from
// GET /project-requests/incoming, told apart by request_type. Both boards share
// one set of status filters (All / New / Accepted / Sent / Declined / Withdrawn),
// a search, a sort and one details sheet.
//   - An owner request is answered with a price: Accept opens the quotation box
//     first (POST /project-requests/accept with quotation_amount).
//   - A supplier request is accepted or rejected as it stands.
//   - The builder's own pending request can be withdrawn (POST /project-requests/withdraw).
//   - An accepted owner request opens the assignment / negotiation panel
//     (GET /projects/{id}/award?request_id= and the /awards/* actions).
// Strings come from the web translation keys (mobile-only ones: mobile.dashboard.*).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useFocusEffect } from '@react-navigation/native'
import { useBuilderInbox } from '../../components/builder/BuilderInbox'
import { View, Text, Alert, TextInput } from 'react-native'
import { House, Truck, Check, X, ClipboardList, Plus, ArrowRight, MapPin, CalendarDays } from 'lucide-react-native'
import DashboardShell, { PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchIncomingRequests,
  acceptProjectRequest,
  rejectProjectRequest,
  withdrawProjectRequest,
  fetchProjectAward,
} from '../../api/requests'
import {
  Section, SegmentTabs, RequestStatusBadge, Badge, ActionButton, SearchBox, SheetModal, InfoRow, Notice,
} from '../../components/builder/BuilderUi'
import AwardPanel from '../../components/builder/AwardPanel'
import { builderFlowStatus, hasAssignmentFlow, FLOW_TONE_COLORS } from '../../utils/awardFlow'
import {
  OWNER_REQUEST_TYPES, SUPPLIER_REQUEST_TYPES, apiErrorText, asList, buildingTypeText, categorizeRequest,
  formatDisplayDate, money,
} from '../../utils/builderHelpers'
import { constructionTypeLabel } from '../../utils/roleLabels'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'

const FILTERS = [
  { id: 'all', labelKey: 'dash.contractor.filter.all' },
  { id: 'pending', labelKey: 'dash.contractor.filter.newRequests' },
  { id: 'accepted', labelKey: 'dash.contractor.filter.accepted' },
  { id: 'sent', labelKey: 'dash.contractor.filter.sent' },
  { id: 'rejected', labelKey: 'dash.contractor.filter.declined' },
  { id: 'withdrawn', labelKey: 'ui.shared.statusWithdrawn' },
]

const SORTS = [
  { id: 'newest', labelKey: 'shop.sortNewest' },
  { id: 'oldest', labelKey: 'shop.sortOldest' },
  { id: 'budgetHigh', labelKey: 'req.board.budgetHigh' },
  { id: 'budgetLow', labelKey: 'req.board.budgetLow' },
]

const ROW_NOTES = {
  owner: { pending: 'dash.contractor.row.incoming', sent: 'dash.contractor.row.proposalSent', accepted: 'dash.contractor.row.quoteApproved', rejected: 'dash.contractor.row.declined', withdrawn: 'ui.shared.statusWithdrawn' },
  supplier: { pending: 'dash.contractor.row.incoming', sent: 'dash.common.requestSent', accepted: 'ui.status.accepted', rejected: 'dash.contractor.row.declined', withdrawn: 'ui.shared.statusWithdrawn' },
}

/** Owner rows as the web board builds them (fallback names, merged budget/area fields). */
function ownerRow(request, t) {
  return {
    ...request,
    sender_name: request.sender_name || request.profile_title || t('role.owner'),
    project_title: request.project_title || t('dash.contractor.homeownerProject'),
    project_address: request.project_address || request.sender_address,
    project_pincode: request.project_pincode || request.sender_pincode,
    budget: request.budget || request.project_budget,
    land_area: request.land_area || request.project_land_area,
    // As the web board sets it: the builder sent every CONTRACTOR_TO_OWNER row.
    is_sender: request.request_type === 'CONTRACTOR_TO_OWNER',
  }
}

function supplierRow(request, t) {
  return { ...request, sender_name: request.sender_name || request.profile_title || t('role.supplier') }
}

/** { [requestId]: award | null } for every accepted owner/builder request (web useRequestAwards). */
function useRequestAwards(requests) {
  const eligible = (requests || []).filter(hasAssignmentFlow)
  const key = eligible.map((request) => `${request.project_id}:${request.id}`).join(',')
  const [awards, setAwards] = useState({})
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    Promise.all(eligible.map((request) => (
      fetchProjectAward(request.project_id, request.id)
        .then((response) => [request.id, response?.award || null])
        .catch(() => [request.id, null])
    ))).then((pairs) => { if (alive) setAwards(Object.fromEntries(pairs)) })
    return () => { alive = false }
    // `key` stands for the eligible list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  return [awards, reload]
}

function FlowBadge({ flow }) {
  const tone = FLOW_TONE_COLORS[flow.tone] || FLOW_TONE_COLORS.waiting
  return <Badge label={flow.label} bg={tone.bg} fg={tone.fg} />
}

export default function ContractorRequestsScreen({ navigation }) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('owner')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState(null)
  const [quoteFor, setQuoteFor] = useState(null)
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteError, setQuoteError] = useState('')
  const [detailsRequest, setDetailsRequest] = useState(null)

  const requests = useAsyncData(fetchIncomingRequests, [])
  useLiveRefresh(() => requests.reload())
  const list = asList(requests.data, 'items', 'requests')

  // Opening the board clears the "new requests" badge for what it lists
  // (web useMarkSeenWhenOpened): once per visit, after a successful load. A
  // request that arrives while the board stays open raises the badge again.
  const inbox = useBuilderInbox()
  const loaded = requests.data !== null && !requests.error
  const pendingIncomingKeys = list
    .filter((row) => row && row.is_receiver && !row.is_sender && String(row.status || '').toLowerCase() === 'pending')
    .map((row) => `request:${row.id}`)
  const pendingKeysSignature = loaded ? pendingIncomingKeys.join('|') : null
  const markRequestsSeen = inbox.markRequestsSeen
  useFocusEffect(useCallback(() => {
    if (pendingKeysSignature !== null) markRequestsSeen(pendingKeysSignature ? pendingKeysSignature.split('|') : [])
    // Only on focus and on the first successful load of this visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]))

  const ownerRequests = useMemo(
    () => list.filter((r) => OWNER_REQUEST_TYPES.includes(String(r.request_type || '').toUpperCase())).map((r) => ownerRow(r, t)),
    [list, t],
  )
  const supplierRequests = useMemo(
    () => list.filter((r) => SUPPLIER_REQUEST_TYPES.includes(String(r.request_type || '').toUpperCase())).map((r) => supplierRow(r, t)),
    [list, t],
  )
  const [awards, reloadAwards] = useRequestAwards(ownerRequests)

  const currentList = activeTab === 'owner' ? ownerRequests : supplierRequests
  const counts = useMemo(() => {
    const totals = { all: currentList.length, pending: 0, accepted: 0, sent: 0, rejected: 0, withdrawn: 0 }
    currentList.forEach((request) => { totals[categorizeRequest(request)] += 1 })
    return totals
  }, [currentList])

  const shown = useMemo(() => {
    let rows = filter === 'all' ? currentList : currentList.filter((r) => categorizeRequest(r) === filter)
    const needle = search.trim().toLowerCase()
    if (needle) {
      rows = rows.filter((request) => [request.sender_name, request.profile_title, request.project_title, request.project_address, request.sender_address, request.project_pincode]
        .some((value) => String(value || '').toLowerCase().includes(needle)))
    }
    if (sortOrder !== 'newest') {
      rows = [...rows]
      if (sortOrder === 'oldest') rows.reverse()
      if (sortOrder === 'budgetHigh') rows.sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
      if (sortOrder === 'budgetLow') rows.sort((a, b) => Number(a.budget || 0) - Number(b.budget || 0))
    }
    return rows
  }, [currentList, filter, search, sortOrder])

  // The banner clears itself, as the web's request banner does.
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  async function refresh() {
    setRefreshing(true)
    try {
      await requests.reload()
      reloadAwards()
    } finally {
      setRefreshing(false)
    }
  }

  async function act(request, task, successText, failureText) {
    if (busyId) return
    setBusyId(request.id)
    try {
      await task()
      setMessage({ tone: 'success', text: successText })
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, failureText) })
      setBusyId(null)
      return
    }
    try {
      await requests.reload()
      reloadAwards()
    } catch {
      // The action succeeded; a refresh failure must not report it as failed.
    } finally {
      setBusyId(null)
    }
  }

  const accept = (request) => act(request, () => acceptProjectRequest(request.id), t('dash.msg.requestAccepted'), t('dash.err.acceptRequest'))
  const reject = (request) => act(request, () => rejectProjectRequest(request.id), t('dash.msg.requestRejected'), t('dash.err.rejectRequest'))
  const withdraw = (request) => {
    Alert.alert(t('mobile.dashboard.withdrawTitle'), t('mobile.dashboard.withdrawBody'), [
      { text: t('dash.common.cancel'), style: 'cancel' },
      {
        text: t('property.action.withdraw'),
        style: 'destructive',
        onPress: () => act(request, () => withdrawProjectRequest(request.id), t('dash.msg.requestWithdrawn'), t('dash.err.withdrawRequest')),
      },
    ])
  }

  function startQuote(request) {
    setQuoteAmount('')
    setQuoteError('')
    setQuoteFor(request)
  }

  async function confirmQuote() {
    const amount = Number(String(quoteAmount).replace(/,/g, '').trim())
    if (!amount || amount <= 0) {
      setQuoteError(t('dash.contractor.quotationHint'))
      return
    }
    const request = quoteFor
    setQuoteFor(null)
    await act(request, () => acceptProjectRequest(request.id, amount), t('dash.msg.quotationSent'), t('dash.err.acceptRequest'))
  }

  const isOwnerTab = activeTab === 'owner'
  const rowNotes = ROW_NOTES[activeTab]

  return (
    <>
      <DashboardShell refreshing={refreshing} onRefresh={refresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
        <Section>
          <View className="rounded-3xl bg-brand-800 p-5">
            <Text className="text-xl font-extrabold text-white">{t('mobile.dashboard.projectRequests')}</Text>
            <Text className="mt-1 text-xs font-semibold text-white/80">{t('mobile.dashboard.projectRequestsSub')}</Text>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 p-3">
                <Text className="text-xs font-bold text-white/80">{t('mobile.dashboard.homeowners')}</Text>
                <Text className="mt-1 text-2xl font-extrabold text-white">{ownerRequests.length}</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 p-3">
                <Text className="text-xs font-bold text-white/80">{t('role.suppliers')}</Text>
                <Text className="mt-1 text-2xl font-extrabold text-white">{supplierRequests.length}</Text>
              </View>
            </View>
          </View>
        </Section>

        <Section>
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <SegmentTabs
                tabs={[
                  { id: 'owner', label: t('dash.contractor.tab.houseOwnerRequests'), count: ownerRequests.length, icon: House },
                  { id: 'supplier', label: t('dash.contractor.tab.supplierRequests'), count: supplierRequests.length, icon: Truck },
                ]}
                active={activeTab}
                onChange={(id) => { setActiveTab(id); setFilter('all') }}
              />
            </View>
          </View>
          {/* New Request opens Find Clients, where a builder sends a request. */}
          <ActionButton
            label={t('req.board.newRequest')}
            icon={Plus}
            small
            onPress={() => navigation.navigate('ContractorMoreTab', { section: 'clients' })}
            className="mt-2 self-start"
          />
        </Section>

        <Section>
          <SegmentTabs
            dense
            tabs={FILTERS.map((item) => ({ id: item.id, label: t(item.labelKey), count: counts[item.id] || 0 }))}
            active={filter}
            onChange={setFilter}
          />
          <View className="mt-2">
            <SearchBox value={search} onChangeText={setSearch} placeholder={t('req.board.searchPh')} />
          </View>
          <View className="mt-2">
            <SegmentTabs dense tabs={SORTS.map((item) => ({ id: item.id, label: t(item.labelKey) }))} active={sortOrder} onChange={setSortOrder} />
          </View>
        </Section>

        <Section>
          <Notice tone={message?.tone} text={message?.text} />
          <PanelState
            loading={requests.loading}
            error={requests.error}
            empty={!shown.length}
            emptyText={currentList.length && (search.trim() || filter !== 'all')
              ? t('req.board.noMatch')
              : isOwnerTab
                ? t('mobile.dashboard.noOwnerRequests')
                : t('ce.noSupplierRequests')}
          >
            {shown.map((request) => {
              const category = categorizeRequest(request)
              const pendingIncoming = category === 'pending'
              const canWithdraw = request.is_sender && category === 'sent'
              const flow = isOwnerTab ? builderFlowStatus(request, awards[request.id], t) : null
              const hasQuote = Number(request.quotation_amount || 0) > 0
              const location = request.project_address || request.sender_address || request.project_pincode || t('dash.owner.estimates.locationNotSet')
              const dateLine = hasQuote && request.quotation_created_at
                ? t('req.board.quotedOn', { date: formatDisplayDate(request.quotation_created_at, '') })
                : request.created_at
                  ? t(request.is_sender ? 'req.board.sentOn' : 'req.board.receivedOn', { date: formatDisplayDate(request.created_at_iso || request.created_at, '') })
                  : ''
              const busy = busyId === request.id
              return (
                <View key={request.id} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                  <View className="flex-row items-start gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                      <ClipboardList size={18} color={COLORS.brand[700]} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{request.sender_name}</Text>
                      {!isOwnerTab && request.profile_title && request.profile_title !== request.sender_name ? (
                        <Text className="text-[11px] font-semibold text-slate-500" numberOfLines={1}>{request.profile_title}</Text>
                      ) : (
                        <Text className="text-[11px] font-semibold text-slate-500">{t(rowNotes[category])}</Text>
                      )}
                    </View>
                    {flow ? <FlowBadge flow={flow} /> : <RequestStatusBadge category={category} sentLabel={t(isOwnerTab ? 'dash.contractor.status.proposalSent' : 'dash.common.requestSent')} />}
                  </View>

                  {(isOwnerTab || request.project_id) ? (
                    <Text className="mt-3 text-[14px] font-extrabold text-graphite" numberOfLines={1}>{request.project_title}</Text>
                  ) : null}
                  <View className="mt-1 flex-row items-center gap-1">
                    <MapPin size={12} color={COLORS.slate[400]} />
                    <Text className="flex-1 text-xs font-semibold text-slate-500" numberOfLines={1}>{location}</Text>
                  </View>
                  {isOwnerTab ? (
                    <Text className="mt-1 text-xs font-semibold text-slate-600">
                      {t('dash.common.budget')}: <Text className="font-extrabold text-graphite">{request.budget ? money(request.budget) : '—'}</Text>
                      {request.land_area ? ` · ${request.land_area} ${t('dash.contractor.sqft')}` : ''}
                    </Text>
                  ) : null}
                  {hasQuote ? (
                    <Text className="mt-0.5 text-xs font-semibold text-slate-600">
                      {t('request.flow.builderQuotation')}: <Text className="font-extrabold text-graphite">{money(request.quotation_amount)}</Text>
                    </Text>
                  ) : null}
                  {dateLine ? (
                    <View className="mt-1 flex-row items-center gap-1">
                      <CalendarDays size={12} color={COLORS.slate[400]} />
                      <Text className="text-[11px] font-semibold text-slate-400">{dateLine}</Text>
                    </View>
                  ) : null}

                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {pendingIncoming && isOwnerTab ? (
                      <>
                        <ActionButton small tone="outline" label={t('dash.contractor.notInterested')} disabled={busy} onPress={() => reject(request)} className="flex-1" />
                        <ActionButton small label={t('dash.contractor.quoteAccept')} icon={ArrowRight} disabled={busy} onPress={() => startQuote(request)} className="flex-1" />
                      </>
                    ) : null}
                    {pendingIncoming && !isOwnerTab ? (
                      <>
                        <ActionButton small tone="danger" label={t('ce.reject')} icon={X} disabled={busy} onPress={() => reject(request)} className="flex-1" />
                        <ActionButton small label={t('ce.accept')} icon={Check} disabled={busy} onPress={() => accept(request)} className="flex-1" />
                      </>
                    ) : null}
                    {canWithdraw ? (
                      <ActionButton small tone="outline" label={t('property.action.withdraw')} disabled={busy} onPress={() => withdraw(request)} />
                    ) : null}
                    <ActionButton
                      small
                      tone="brandOutline"
                      label={flow ? t('req.board.viewRequest') : t('dash.contractor.viewDetails')}
                      icon={ArrowRight}
                      onPress={() => setDetailsRequest(request)}
                    />
                  </View>
                </View>
              )
            })}
          </PanelState>
        </Section>
      </DashboardShell>

      {/* Quotation box — an owner request is answered with a price. */}
      <SheetModal
        visible={!!quoteFor}
        title={t('mobile.dashboard.yourQuotation')}
        subtitle={quoteFor?.project_title}
        onClose={() => setQuoteFor(null)}
        footer={(
          <View className="flex-row gap-2">
            <ActionButton label={t('dash.common.cancel')} tone="outline" onPress={() => setQuoteFor(null)} className="flex-1" />
            <ActionButton label={t('dash.contractor.quoteAccept')} icon={Check} onPress={confirmQuote} className="flex-1" />
          </View>
        )}
      >
        {quoteFor?.budget ? <InfoRow label={t('owner.pa.ownerBudget')} value={money(quoteFor.budget)} strong /> : null}
        <Text className="mb-1 mt-3 text-xs font-bold text-slate-600">{t('dash.contractor.amount')}</Text>
        <TextInput
          value={quoteAmount}
          onChangeText={(value) => { setQuoteError(''); setQuoteAmount(value.replace(/[^\d.]/g, '')) }}
          keyboardType="numeric"
          placeholder={`${t('dash.contractor.amount')} (₹)`}
          placeholderTextColor={COLORS.slate[400]}
          autoFocus
          className="h-12 rounded-xl border border-brand-300 bg-white px-3 text-[16px] font-extrabold text-graphite"
        />
        {Number(quoteAmount) > 0 ? <Text className="mt-1 text-xs font-bold text-slate-600">{money(quoteAmount)}</Text> : null}
        {quoteError ? <Text className="mt-2 text-xs font-bold text-rose-600">{quoteError}</Text> : null}
      </SheetModal>

      {/* Request details, with the assignment / negotiation for an accepted owner request. */}
      <SheetModal
        visible={!!detailsRequest}
        tall
        title={detailsRequest?.project_title || t('dash.contractor.requestDetails')}
        subtitle={t('dash.contractor.requestDetails')}
        onClose={() => setDetailsRequest(null)}
      >
        {detailsRequest ? (
          <RequestDetails
            request={detailsRequest}
            variant={activeTab}
            award={awards[detailsRequest.id] || null}
            onAwardChanged={() => { reloadAwards(); requests.reload() }}
          />
        ) : null}
      </SheetModal>
    </>
  )
}

function RequestDetails({ request, variant, award, onAwardChanged }) {
  const { t } = useLanguage()
  const category = categorizeRequest(request)
  const flow = variant === 'owner' ? builderFlowStatus(request, award, t) : null
  const negotiation = variant === 'owner' && hasAssignmentFlow(request)
  return (
    <View>
      <View className="mb-3">
        {flow ? <FlowBadge flow={flow} /> : <RequestStatusBadge category={category} sentLabel={t(variant === 'owner' ? 'dash.contractor.status.proposalSent' : 'dash.common.requestSent')} />}
      </View>
      <InfoRow label={t(variant === 'owner' ? 'dash.contractor.homeowner' : 'role.supplier')} value={request.sender_name} strong />
      <InfoRow label={t('dash.msg.location')} value={request.project_address || request.sender_address || request.project_pincode} />
      {variant === 'owner' ? <InfoRow label={negotiation ? t('dash.common.originalBudget') : t('dash.common.budget')} value={request.budget ? money(request.budget) : ''} /> : null}
      {Number(request.quotation_amount || 0) > 0 ? <InfoRow label={t('request.flow.builderQuotation')} value={money(request.quotation_amount)} strong /> : null}
      <InfoRow label={t('dash.contractor.area')} value={request.land_area ? `${request.land_area} ${t('dash.contractor.sqft')}` : ''} />
      <InfoRow label={t('dash.common.buildingType')} value={buildingTypeText(request.building_type, t)} />
      <InfoRow label={t('dash.common.construction')} value={constructionTypeLabel(request.construction_type, t)} />
      {request.created_at ? (
        <InfoRow label={t(request.is_sender ? 'mobile.dashboard.sentOn' : 'mobile.dashboard.receivedOn')} value={formatDisplayDate(request.created_at_iso || request.created_at, '')} />
      ) : null}
      {request.project_description ? (
        <View className="mt-3">
          <Text className="mb-1 text-[10px] font-extrabold uppercase text-slate-400">{t('dash.common.description')}</Text>
          <Text className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{request.project_description}</Text>
        </View>
      ) : null}
      {negotiation ? (
        <View className="mt-4">
          <AwardPanel projectId={request.project_id} requestId={request.id} onChanged={onAwardChanged} />
        </View>
      ) : null}
    </View>
  )
}
