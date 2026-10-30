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
import { View, Text, Alert, TextInput, Pressable, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { userAvatarSource } from '../../utils/avatars'
import { House, Truck, Check, X, Plus, ArrowRight, MapPin, CalendarDays, LayoutGrid, List, SlidersHorizontal } from 'lucide-react-native'
import DashboardShell, { PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchIncomingRequests,
  acceptProjectRequest,
  rejectProjectRequest,
  withdrawProjectRequest,
  fetchProjectAward,
} from '../../api/requests'
import {
  Section, SegmentTabs, RequestStatusBadge, Badge, ActionButton, SearchBox, SheetModal, InfoRow, Notice, SelectChip, ViewToggle,} from '../../components/builder/BuilderUi'
import AwardPanel from '../../components/builder/AwardPanel'
import { builderFlowStatus, hasAssignmentFlow, FLOW_TONE_COLORS } from '../../utils/awardFlow'
import {
  OWNER_REQUEST_TYPES, SUPPLIER_REQUEST_TYPES, apiErrorText, asList, buildingTypeText, categorizeRequest,
  formatDisplayDate, money,
} from '../../utils/builderHelpers'
import { constructionTypeLabel } from '../../utils/roleLabels'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

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
// Status chip colours (web: brand, sky, emerald, violet, rose, slate).
const CHIP_TONES = {
  all: { bg: '#e7f0eb', fg: '#14532d', onBg: '#14532d', onFg: '#ffffff' },
  pending: { bg: '#f0f9ff', fg: '#0369a1', onBg: '#0369a1', onFg: '#ffffff' },
  accepted: { bg: '#ecfdf5', fg: '#047857', onBg: '#047857', onFg: '#ffffff' },
  sent: { bg: '#f5f3ff', fg: '#6d28d9', onBg: '#6d28d9', onFg: '#ffffff' },
  rejected: { bg: '#fff1f2', fg: '#be123c', onBg: '#be123c', onFg: '#ffffff' },
  withdrawn: { bg: '#f1f5f9', fg: '#475569', onBg: '#475569', onFg: '#ffffff' },
}

// House-owner board empty states, per status filter (web).
const EMPTY_KEYS = {
  all: { title: 'dash.contractor.empty.allTitle', body: 'dash.contractor.empty.allBody', hint: 'dash.contractor.empty.allHint' },
  pending: { title: 'dash.contractor.empty.pendingTitle', body: 'dash.contractor.empty.pendingBody', hint: 'dash.contractor.empty.pendingHint' },
  accepted: { title: 'dash.contractor.empty.acceptedTitle', body: 'dash.contractor.empty.acceptedBody' },
  sent: { title: 'dash.contractor.empty.sentTitle', body: 'dash.contractor.empty.sentBody' },
  rejected: { title: 'dash.contractor.empty.rejectedTitle', body: 'dash.contractor.empty.rejectedBody' },
  withdrawn: { title: 'dash.contractor.empty.withdrawnTitle', body: 'dash.contractor.empty.withdrawnBody' },
}
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
  const [view, setView] = useState('cards')
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
          <SegmentTabs
            tabs={[
              { id: 'owner', label: t('dash.contractor.tab.houseOwnerRequests'), count: ownerRequests.length, icon: House },
              { id: 'supplier', label: t('dash.contractor.tab.supplierRequests'), count: supplierRequests.length, icon: Truck },
            ]}
            active={activeTab}
            onChange={(id) => { setActiveTab(id); setFilter('all') }}
          />
        </Section>

        <Section>
          <View style={styles.view}>
            {/* Status chips, in the web's colours. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {FILTERS.map((item) => {
                const on = filter === item.id
                const tone = CHIP_TONES[item.id]
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setFilter(item.id)}
                    style={[styles.pressable, { backgroundColor: on ? tone.onBg : soft(tone.bg, tone.fg) }]}
                  >
                    <Text style={[styles.text, { color: on ? tone.onFg : ink(tone.fg) }]}>{t(item.labelKey)}</Text>
                    <View style={[styles.view2, on ? styles.view3 : styles.view4]}>
                      <Text style={[styles.text2, { color: on ? tone.onBg : ink(tone.fg) }]}>{counts[item.id] || 0}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
            <View style={styles.view5}>
              <SearchBox value={search} onChangeText={setSearch} placeholder={t('req.board.searchPh')} />
            </View>
            <View style={styles.view6}>
              <ViewToggle
                options={[{ id: 'cards', label: t('dash.supplier.cards'), icon: LayoutGrid }, { id: 'table', label: t('dash.supplier.table'), icon: List }]}
                active={view}
                onChange={setView}
              />
              {/* The web's "Filters" menu sorts the board. */}
              <SelectChip
                placeholder={t('req.board.filters')}
                icon={SlidersHorizontal}
                value={sortOrder === 'newest' ? '' : sortOrder}
                onChange={(value) => setSortOrder(value || 'newest')}
                options={SORTS.filter((item) => item.id !== 'newest').map((item) => ({ value: item.id, label: t(item.labelKey) }))}
              />
              <View style={styles.view7}>
                {/* New Request opens Find Clients, where a builder sends a request (web). */}
                <ActionButton label={t('req.board.newRequest')} icon={Plus} small onPress={() => navigation.navigate('ContractorMoreTab', { section: 'clients' })} />
              </View>
            </View>
          </View>
        </Section>

        <Section>
          <Notice tone={message?.tone} text={message?.text} />
          <PanelState
            loading={requests.loading}
            error={requests.error}
            empty={!shown.length}
                        emptyText={search.trim() && currentList.length
              ? t('req.board.noMatch')
              : isOwnerTab
                ? [t(EMPTY_KEYS[filter].title), t(EMPTY_KEYS[filter].body), EMPTY_KEYS[filter].hint ? t(EMPTY_KEYS[filter].hint) : ''].filter(Boolean).join('\n')
                : `${t('ce.noSupplierRequests')}\n${t('ce.noSupplierRequestsSub')}`}
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
              if (view === 'table') {
                // Table row (web board table): counterparty, project, budget, status, action.
                return (
                  <Pressable key={request.id} onPress={() => setDetailsRequest(request)} style={styles.pressable2}>
                    <View style={styles.view8}>
                      <Image source={userAvatarSource(request, isOwnerTab ? 'OWNER' : 'SUPPLIER')} style={{ width: 28, height: 28, borderRadius: 14 }} contentFit="cover" />
                      <View style={styles.actionButton}>
                        <Text style={styles.text3} numberOfLines={1}>{request.sender_name}</Text>
                        <Text style={styles.text4} numberOfLines={1}>
                          {[request.project_title, location].filter(Boolean).join(' · ')}
                        </Text>
                        {isOwnerTab ? (
                          <Text style={styles.text5} numberOfLines={1}>
                            {request.budget ? money(request.budget) : '—'}{request.land_area ? ` · ${request.land_area} ${t('dash.contractor.sqft')}` : ''}{hasQuote ? ` · ${t('request.flow.builderQuotation')}: ${money(request.quotation_amount)}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      {flow ? <FlowBadge flow={flow} /> : <RequestStatusBadge category={category} sentLabel={t(isOwnerTab ? 'dash.contractor.status.proposalSent' : 'dash.common.requestSent')} />}
                    </View>
                    {pendingIncoming || canWithdraw ? (
                      <View style={styles.view9}>
                        {pendingIncoming && isOwnerTab ? (
                          <>
                            <ActionButton small label={t('dash.contractor.quoteAccept')} disabled={busy} onPress={() => startQuote(request)} />
                            <ActionButton small tone="outline" label={t('dash.contractor.notInterested')} disabled={busy} onPress={() => reject(request)} />
                          </>
                        ) : null}
                        {pendingIncoming && !isOwnerTab ? (
                          <>
                            <ActionButton small label={t('ce.accept')} disabled={busy} onPress={() => accept(request)} />
                            <ActionButton small tone="danger" label={t('ce.reject')} disabled={busy} onPress={() => reject(request)} />
                          </>
                        ) : null}
                        {canWithdraw ? <ActionButton small tone="outline" label={t('property.action.withdraw')} disabled={busy} onPress={() => withdraw(request)} /> : null}
                      </View>
                    ) : null}
                  </Pressable>
                )
              }
              return (
                <View key={request.id} style={styles.view10}>
                  <View style={styles.view11}>
                                        <Image source={userAvatarSource(request, isOwnerTab ? 'OWNER' : 'SUPPLIER')} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                    <View style={styles.actionButton}>
                      <Text style={styles.text6} numberOfLines={1}>{request.sender_name}</Text>
                      {!isOwnerTab && request.profile_title && request.profile_title !== request.sender_name ? (
                        <Text style={styles.text4} numberOfLines={1}>{request.profile_title}</Text>
                      ) : (
                        <Text style={styles.text4}>{t(rowNotes[category])}</Text>
                      )}
                    </View>
                    {flow ? <FlowBadge flow={flow} /> : <RequestStatusBadge category={category} sentLabel={t(isOwnerTab ? 'dash.contractor.status.proposalSent' : 'dash.common.requestSent')} />}
                  </View>

                  {(isOwnerTab || request.project_id) ? (
                    <Text style={styles.text7} numberOfLines={1}>{request.project_title}</Text>
                  ) : null}
                  <View style={styles.view12}>
                    <MapPin size={12} color={COLORS.slate[400]} />
                    <Text style={styles.text8} numberOfLines={1}>{location}</Text>
                  </View>
                  {isOwnerTab ? (
                    <Text style={styles.text9}>
                      {t('dash.common.budget')}: <Text style={styles.text10}>{request.budget ? money(request.budget) : '—'}</Text>
                      {request.land_area ? ` · ${request.land_area} ${t('dash.contractor.sqft')}` : ''}
                    </Text>
                  ) : null}
                  {hasQuote ? (
                    <Text style={styles.text11}>
                      {t('request.flow.builderQuotation')}: <Text style={styles.text10}>{money(request.quotation_amount)}</Text>
                    </Text>
                  ) : null}
                  {dateLine ? (
                    <View style={styles.view12}>
                      <CalendarDays size={12} color={COLORS.slate[400]} />
                      <Text style={styles.text12}>{dateLine}</Text>
                    </View>
                  ) : null}

                  <View style={styles.view13}>
                    {pendingIncoming && isOwnerTab ? (
                      <>
                        <ActionButton small tone="outline" label={t('dash.contractor.notInterested')} disabled={busy} onPress={() => reject(request)} style={styles.actionButton} />
                        <ActionButton small label={t('dash.contractor.quoteAccept')} icon={ArrowRight} disabled={busy} onPress={() => startQuote(request)} style={styles.actionButton} />
                      </>
                    ) : null}
                    {pendingIncoming && !isOwnerTab ? (
                      <>
                        <ActionButton small tone="danger" label={t('ce.reject')} icon={X} disabled={busy} onPress={() => reject(request)} style={styles.actionButton} />
                        <ActionButton small label={t('ce.accept')} icon={Check} disabled={busy} onPress={() => accept(request)} style={styles.actionButton} />
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
          <View style={styles.view14}>
            <ActionButton label={t('dash.common.cancel')} tone="outline" onPress={() => setQuoteFor(null)} style={styles.actionButton} />
            <ActionButton label={t('dash.contractor.quoteAccept')} icon={Check} onPress={confirmQuote} style={styles.actionButton} />
          </View>
        )}
      >
        {quoteFor?.budget ? <InfoRow label={t('owner.pa.ownerBudget')} value={money(quoteFor.budget)} strong /> : null}
        <Text style={styles.text13}>{t('dash.contractor.amount')}</Text>
        <TextInput
          value={quoteAmount}
          onChangeText={(value) => { setQuoteError(''); setQuoteAmount(value.replace(/[^\d.]/g, '')) }}
          keyboardType="numeric"
          placeholder={`${t('dash.contractor.amount')} (₹)`}
          placeholderTextColor={COLORS.slate[400]}
          autoFocus
          style={styles.textInput}
        />
        {Number(quoteAmount) > 0 ? <Text style={styles.text14}>{money(quoteAmount)}</Text> : null}
        {quoteError ? <Text style={styles.text15}>{quoteError}</Text> : null}
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
      <View style={styles.view15}>
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
        <View style={styles.view16}>
          <Text style={styles.text16}>{t('dash.common.description')}</Text>
          <Text style={styles.text17}>{request.project_description}</Text>
        </View>
      ) : null}
      {negotiation ? (
        <View style={styles.view17}>
          <AwardPanel projectId={request.project_id} requestId={request.id} onChanged={onAwardChanged} />
        </View>
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  pressable: { flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 9999, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  text: { fontSize: 12, fontWeight: '800' },
  view2: { minWidth: 18, alignItems: 'center', borderRadius: 9999, paddingHorizontal: 3.5 },
  view3: { backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  view4: { backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  text2: { fontSize: 10, fontWeight: '800' },
  view5: { marginTop: 7 },
  view6: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  view7: { flex: 1, alignItems: 'flex-end' },
  pressable2: { borderBottomWidth: 1, borderColor: c.borderSoft, backgroundColor: c.card, paddingHorizontal: 3.5, paddingVertical: 10.5 },
  view8: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  actionButton: { flex: 1 },
  text3: { fontSize: 13, fontWeight: '800', color: c.text },
  text4: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  text5: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  view9: { marginLeft: 35, marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  view10: { marginBottom: 10.5, borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view11: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5 },
  text6: { fontSize: 14, fontWeight: '800', color: c.text },
  text7: { marginTop: 10.5, fontSize: 14, fontWeight: '800', color: c.text },
  view12: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text8: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  text9: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  text10: { fontWeight: '800', color: c.text },
  text11: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  text12: { fontSize: 11, fontWeight: '600', color: c.textFaint },
  view13: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  view14: { flexDirection: 'row', gap: 7 },
  text13: { marginBottom: 3.5, marginTop: 10.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  textInput: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#9dc5af', backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 16, fontWeight: '800', color: c.text },
  text14: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  text15: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.roseTextSoft },
  view15: { marginBottom: 10.5 },
  view16: { marginTop: 10.5 },
  text16: { marginBottom: 3.5, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.textFaint },
  text17: { borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7, fontSize: 12, lineHeight: 17.5, color: c.textSecondary },
  view17: { marginTop: 14 },
}))
