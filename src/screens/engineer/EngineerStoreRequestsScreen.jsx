// Store Requests: the Site Engineer's requests to the Store Manager and what
// happened to each — port of the web pages/engineer/EngineerStoreRequestsSection.jsx.
// Same records (/store/site-requests/mine, every project), the same filters
// (All / Pending / Approved), the Request ID search and Cancel. One card per
// request with its products; View details opens the whole request (lines,
// supplier purchases, history) in a sheet.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { ClipboardList, Eye, Search } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { cancelSiteRequest, fetchMySiteRequests, refusalText } from '../../api/store'
import { formatDateTime } from '../../utils/formatters'
import {
  REQUEST_FILTERS, filterRequests, formatQty, purchaseRef, requestFilterCounts, requestRef, searchRequests,
} from '../../utils/storeHelpers'
import { toast } from '../../components/Toast'
import { ActionButton, Notice, Section, SegmentTabs, SheetModal, StackScreenShell } from '../../components/builder/BuilderUi'
import StatusPill from '../../components/StatusPill'
import { COLORS } from '../../theme/tokens'
import { ink } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

function Fact({ label, children, wide = false }) {
  return (
    <View style={[styles.fact, wide ? styles.factWide : null]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} selectable>{children || '—'}</Text>
    </View>
  )
}

// The whole request: who and what, every product with what was approved,
// delivered, still owed and bought from a supplier, the purchases and the history.
function RequestDetails({ request }) {
  const { t, td } = useLanguage()
  const qty = (value, unit) => `${formatQty(value)} ${td(unit)}`
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.facts}>
        <Fact wide label={t('store.requests.requestId')}>{requestRef(request)}</Fact>
        <Fact label={t('store.col.requestDate')}>{formatDateTime(request.created_at)}</Fact>
        <Fact label={t('store.col.siteEngineer')}>{td(request.engineer_name)}</Fact>
        <Fact label={t('ui.profile.engCat.storeManager')}>{td(request.store_manager_name)}</Fact>
        <Fact label={t('store.requests.builder')}>{td(request.builder_name)}</Fact>
        <Fact label={t('store.col.project')}>{td(request.project_name)}</Fact>
        <Fact label={t('store.col.approvalDate')}>{request.decided_at && request.approved_by ? formatDateTime(request.decided_at) : ''}</Fact>
        <Fact label={t('store.col.fulfilledDate')}>{request.issued_at ? formatDateTime(request.issued_at) : ''}</Fact>
      </View>
      <View style={styles.inline}>
        <StatusPill status={request.stage || request.status} />
        {request.procurement_status && request.procurement_status !== 'NONE' ? <Text style={styles.meta}>{t(`store.procurement.summary.${request.procurement_status}`)}</Text> : null}
      </View>
      {request.note ? <Text style={styles.note}>{td(request.note)}</Text> : null}

      {request.lines.map((line) => (
        <View key={line.id} style={styles.line}>
          <Text style={styles.name}>{td(line.item_name)}{line.variant ? ` · ${td(line.variant)}` : ''}</Text>
          {line.category ? <Text style={styles.meta}>{td(line.category)}</Text> : null}
          <View style={styles.lineGrid}>
            <Fact label={t('store.col.requested')}>{qty(line.quantity, line.unit)}</Fact>
            <Fact label={t('store.col.approved')}>{qty(line.approved_quantity, line.unit)}</Fact>
                    <View style={styles.fact}><Text style={styles.factLabel}>{t('store.col.delivered')}</Text><Text style={[styles.factValue, { color: ink('#047857') }]}>{qty(line.issued, line.unit)}</Text></View>
            <View style={styles.fact}><Text style={styles.factLabel}>{t('store.col.remaining')}</Text><Text style={[styles.factValue, line.remaining > 0 ? { color: ink('#b45309') } : null]}>{qty(line.remaining, line.unit)}</Text></View>
            <Fact label={t('store.col.orderedFromSupplier')}>{line.ordered > 0 ? qty(line.ordered, line.unit) : '—'}</Fact>
            <Fact label={t('store.col.receivedByStore')}>{line.ordered > 0 ? qty(line.received, line.unit) : '—'}</Fact>
          </View>
        </View>
      ))}

      <View style={styles.box}>
        <Text style={styles.name}>{t('store.procurement.title')}</Text>
        {request.purchases?.length ? request.purchases.map((purchase) => (
          <Text key={purchaseRef(purchase)} style={styles.meta}>
            <Text style={styles.mono} selectable>{purchaseRef(purchase)}</Text>
            {purchase.supplier_name ? ` · ${td(purchase.supplier_name)}` : ''}
            {` · ${purchase.lines.map((line) => `${td(line.item_name)} × ${qty(line.quantity, line.unit)}`).join(', ')} · `}
            <Text style={styles.strong}>{t(`store.procurement.status.${purchase.status}`)}</Text>
          </Text>
        )) : <Text style={styles.faint}>{t('store.requests.noProcurement')}</Text>}
      </View>
      <View style={styles.box}>
        <Text style={styles.name}>{t('store.requests.history')}</Text>
        {(request.timeline || []).map((step, index) => (
          <Text key={`${step.event}-${index}`} style={[styles.meta, !step.at ? { color: ink('#b45309') } : null]}>            {`• ${t(`store.timeline.${step.event}`)}${step.at ? ` · ${formatDateTime(step.at)}` : ''}`}
          </Text>
        ))}
      </View>
      {request.decision_note ? <Text style={styles.meta}>{`${t('store.requests.decisionNote')}: ${td(request.decision_note)}`}</Text> : null}
    </View>
  )
}

function RequestCard({ request, onOpen }) {
  const { t, td } = useLanguage()
  return (
    <Pressable onPress={() => onOpen(request.id)} style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={[styles.mono, { flex: 1 }]} selectable>{requestRef(request)}</Text>
        <StatusPill status={request.stage || request.status} />
      </View>
      <Text style={styles.meta}>{[formatDateTime(request.created_at), td(request.project_name)].filter(Boolean).join(' · ')}</Text>
      <View style={styles.cardLines}>
        {request.lines.map((line) => (
          <View key={line.id} style={styles.cardLine}>
            <Text style={[styles.lineName, { flex: 1 }]} numberOfLines={2}>
              {td(line.item_name)}{line.variant ? <Text style={styles.meta}>{` · ${td(line.variant)}`}</Text> : null}
            </Text>
            <Text style={styles.meta}>{`${formatQty(line.quantity)} ${td(line.unit)}`}</Text>
            <Text style={[styles.meta, { color: ink('#047857'), minWidth: 54, textAlign: 'right' }]}>{`${formatQty(line.issued)} ${td(line.unit)}`}</Text>      
                </View>
        ))}
      </View>
      <View style={styles.cardFoot}>
        <Text style={styles.faint}>{`${t('store.col.requested')} / ${t('store.col.delivered')}`}</Text>
        <View style={styles.viewButton}>
          <Eye size={12} color={COLORS.slate[600]} />
          <Text style={styles.viewText}>{t('store.viewDetails')}</Text>
        </View>
      </View>
    </Pressable>
  )
}

export default function EngineerStoreRequestsScreen({ navigation }) {
  const { t, td } = useLanguage()
  const [requests, setRequests] = useState([])
  const [loaded, setLoaded] = useState(false)
  // A failed load stays in place of the list; a cancel's result is a bottom toast.
  const [loadFailed, setLoadFailed] = useState(false)
  const [historyGroup, setHistoryGroup] = useState('ALL')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  const reload = useCallback(() => fetchMySiteRequests()
    .then((list) => { setRequests(Array.isArray(list) ? list : []); setLoaded(true); setLoadFailed(false) })
    .catch(() => setLoadFailed(true)), [])
  useEffect(() => {
    reload()
    const timer = setInterval(reload, 15000)
    return () => clearInterval(timer)
  }, [reload])
  // A Store Manager's approval, issue or purchase arrives as the live hint.
  useLiveRefresh(reload)

  const onRefresh = async () => {
    setRefreshing(true)
    try { await reload() } finally { setRefreshing(false) }
  }
  const cancel = async (id, ref) => {
    setCancellingId(id)
    try {
      await cancelSiteRequest(id)
      toast.success(t('store.engineer.cancelled', { id: ref }))
      reload()
    } catch (error) {
      toast.error(refusalText(error, td, t('store.saveFailed')))
    } finally {
      setCancellingId(null)
    }
  }

  const found = searchRequests(requests, search)
  const groupCounts = requestFilterCounts(found)
  const shownRequests = filterRequests(found, historyGroup)
  const open = openId ? requests.find((request) => request.id === openId) : null

  return (
    <StackScreenShell title={t('store.engineer.myRequests')} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={onRefresh}>
      <Section>
        {loadFailed ? <Notice tone="error" text={t('store.engineer.historyLoadFailed')} /> : null}
        {requests.length ? (
          <View style={{ gap: 10 }}>
            <SegmentTabs
              tabs={REQUEST_FILTERS.map((item) => ({ id: item.id, label: t(item.label), count: groupCounts[item.id] }))}
              active={historyGroup}
              onChange={setHistoryGroup}
            />
            <View style={styles.search}>
              <Search size={15} color={COLORS.slate[400]} />
              <TextInput value={search} onChangeText={setSearch} placeholder={t('store.requests.searchId')} placeholderTextColor={COLORS.slate[400]} autoCapitalize="none" style={styles.searchInput} />
            </View>
            {shownRequests.length
              ? shownRequests.map((request) => <RequestCard key={request.id} request={request} onOpen={setOpenId} />)
              : <Text style={styles.dashed}>{t(search.trim() ? 'store.requests.noSearchMatch' : 'store.engineer.historyEmpty')}</Text>}
          </View>
        ) : loaded ? (
          <View style={styles.empty}>
            <ClipboardList size={26} color={COLORS.slate[400]} />
            <Text style={styles.emptyTitle}>{t('store.engineer.noRequests')}</Text>
            <Text style={styles.emptyBody}>{t('store.engineer.noRequestsSub')}</Text>
          </View>
        ) : null}
      </Section>

      <SheetModal
        visible={Boolean(open)}
        tall
        title={open ? `${t('store.requests.requestId')} ${requestRef(open)}` : ''}
        subtitle={open ? [open.builder_name, open.project_name].filter(Boolean).map((value) => td(value)).join(' · ') : ''}
        onClose={() => setOpenId(null)}
        footer={open?.can_cancel ? (
          <ActionButton tone="outline" label={t('store.engineer.cancel')} disabled={cancellingId === open.id} busy={cancellingId === open.id} onPress={() => cancel(open.id, requestRef(open))} />
        ) : null}
      >
        {open ? (
          <View style={{ gap: 8 }}>
            <RequestDetails request={open} />
          </View>
        ) : null}
      </SheetModal>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  search: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text },
  dashed: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 14, paddingVertical: 28, textAlign: 'center', fontSize: 13, fontWeight: '600', color: c.textMuted },
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 28 },
  emptyTitle: { marginTop: 4, textAlign: 'center', fontSize: 14, fontWeight: '800', color: c.text },
  emptyBody: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.textMuted },
  card: { gap: 6, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLines: { gap: 4, borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 6 },
  cardLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  viewButton: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 8 },
  viewText: { fontSize: 11, fontWeight: '800', color: c.textSoft },
  mono: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: c.text },
  lineName: { fontSize: 12.5, fontWeight: '800', color: c.text },
  name: { fontSize: 13, fontWeight: '800', color: c.text },
  meta: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  faint: { fontSize: 11, fontWeight: '600', color: c.textFaint },
  strong: { fontWeight: '800', color: c.text },
  note: { borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: '600', color: c.textSoft },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
  fact: { width: '50%', paddingRight: 6 },
  factWide: { width: '100%' },
  factLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  factValue: { fontSize: 12, fontWeight: '700', color: c.text },
  line: { gap: 2, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
  lineGrid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  box: { gap: 3, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
}))