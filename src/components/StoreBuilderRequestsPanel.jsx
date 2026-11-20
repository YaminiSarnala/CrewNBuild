// Requests between a Builder and a Store Manager on that Builder's team, either
// way round — port of the web pages/store-manager/StoreBuilderRequestsPanel.jsx.
// The server says which side the reader is on (`side`), who they can write to
// (`counterparts`) and, per request, whether they sent it, may answer it or may
// withdraw it. Its own records (/store-builder-requests), never mixed with any
// other request list.
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Check, Eye, Inbox, Plus, Send, Undo2, X } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { useLiveRefresh } from '../hooks/useLiveRefresh'
import {
  createStoreBuilderRequest, fetchStoreBuilderRequests, refusalText, respondStoreBuilderRequest, withdrawStoreBuilderRequest,
} from '../api/store'
import { formatDateTime } from '../utils/formatters'
import { ActionButton, LabeledInput, SegmentTabs, SelectChip, SheetModal } from './builder/BuilderUi'
import { toast } from './Toast'
import StatusPill from './StatusPill'
import { COLORS } from '../theme/tokens'
import { ink, soft } from '../theme/tint'
import { createStyles } from '../theme/createStyles'

export const BUILDER_REQUEST_CATEGORIES = ['GENERAL', 'MATERIAL', 'DELIVERY', 'PAYMENT', 'SCHEDULE', 'OTHER']

// The words each side reads: a Store Manager writes to Builders, a Builder to Store Managers.
const SIDE_TEXT = {
  STORE_MANAGER: {
    received: 'store.sbr.incomingBuilder', sent: 'store.sbr.sentToBuilder', counterpart: 'store.requests.builder',
    newRequest: 'store.sbr.newToBuilder', noCounterpart: 'store.sbr.noBuilder',
  },
  BUILDER: {
    received: 'store.sbr.fromStoreManager', sent: 'store.sbr.sentToStoreManager', counterpart: 'ui.profile.engCat.storeManager',
    newRequest: 'store.sbr.newToStoreManager', noCounterpart: 'store.sbr.noStoreManager',
  },
}

/** Loads this reader's requests and keeps them current (live hints and a slow poll). */
export function useStoreBuilderRequests() {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)
  const reload = useCallback(() => {
    seq.current += 1
    const mine = seq.current
    return fetchStoreBuilderRequests()
      .then((result) => { if (mine === seq.current) { setData(result); setFailed(false) } })
      .catch(() => { if (mine === seq.current) setFailed(true) })
  }, [])
  useLiveRefresh(reload)
  useEffect(() => {
    reload()
    const timer = setInterval(reload, 30000)
    return () => clearInterval(timer)
  }, [reload])
  return { data, failed, reload }
}

function NewRequestSheet({ text, counterparts, onDone, onClose }) {
  const { t, td } = useLanguage()
  const [form, setForm] = useState({ counterpart_id: counterparts.length === 1 ? String(counterparts[0].id) : '', category: 'GENERAL', title: '', description: '' })
  const [saving, setSaving] = useState(false)
  // Each missing or short field is highlighted under itself; the toast sums it up.
  const [errors, setErrors] = useState({})
  const update = (field) => (value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: '' })) }
  const textProblem = (value) => (!value.trim() ? t('ui.shared.required') : value.trim().length < 3 ? 'Enter at least 3 characters.' : '')
  const submit = async () => {
    const problems = {}
    if (!form.counterpart_id) problems.counterpart_id = t('ui.shared.required')
    if (textProblem(form.title)) problems.title = textProblem(form.title)
    if (textProblem(form.description)) problems.description = textProblem(form.description)
    setErrors(problems)
    if (Object.keys(problems).length) {
      toast.error(t('store.sbr.fillAll'))
      return
    }
    setSaving(true)
    try {
      await createStoreBuilderRequest({ ...form, title: form.title.trim(), description: form.description.trim() })
      onDone()
    } catch (failure) {
      toast.error(refusalText(failure, td, t('store.saveFailed')))
      setSaving(false)
    }
  }
  return (
    <SheetModal
      visible
      tall
      title={t(text.newRequest)}
      onClose={onClose}
      footer={(
        <View style={styles.actions}>
          <ActionButton small tone="outline" label={t('store.cancel')} onPress={onClose} />
          <ActionButton small icon={Send} label={saving ? t('dash.common.saving') : t('store.sbr.send')} onPress={submit} busy={saving} disabled={saving} />
        </View>
      )}
    >
      <Text style={styles.label}>{t(text.counterpart)}</Text>
      <View style={[styles.chipRow, errors.counterpart_id ? styles.chipInvalid : null]}>
        <SelectChip
          placeholder={t('store.sbr.choose')}
          value={form.counterpart_id}
          onChange={update('counterpart_id')}
          options={counterparts.map((person) => ({ value: String(person.id), label: td(person.name) }))}
        />
      </View>
      {errors.counterpart_id ? <Text accessibilityRole="alert" style={styles.fieldError}>{errors.counterpart_id}</Text> : null}
      <Text style={styles.label}>{t('store.sbr.type')}</Text>
      <View style={styles.chipRow}>
        <SelectChip
          placeholder={t('store.sbr.type')}
          value={form.category}
          onChange={(value) => update('category')(value || 'GENERAL')}
          options={BUILDER_REQUEST_CATEGORIES.map((category) => ({ value: category, label: t(`store.sbr.category.${category}`) }))}
        />
      </View>
      <LabeledInput label={t('store.sbr.title')} value={form.title} error={errors.title} onChangeText={update('title')} maxLength={160} placeholder={t('store.sbr.titlePh')} />
      <LabeledInput label={t('store.sbr.description')} value={form.description} error={errors.description} onChangeText={update('description')} maxLength={2000} multiline placeholder={t('store.sbr.descriptionPh')} />
    </SheetModal>
  )
}

function RequestDetailSheet({ request, text, counterpartName, onChanged, onClose }) {
  const { t, td } = useLanguage()
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const act = async (action, doneKey) => {
    setBusy(true)
    try {
      await action()
      toast.success(t(doneKey))
      onChanged()
    } catch (failure) {
      toast.error(refusalText(failure, td, t('store.saveFailed')))
    } finally {
      setBusy(false)
    }
  }
  const facts = [
    ['store.requests.requestId', `#${request.id}`],
    ['store.sbr.direction', t(request.sent_by_me ? 'store.sbr.youSent' : 'store.sbr.youReceived')],
    [text.counterpart, counterpartName],
    ['store.sbr.type', t(`store.sbr.category.${request.category}`)],
    ['store.col.requestDate', formatDateTime(request.created_at)],
    ['store.sbr.respondedOn', request.responded_at ? formatDateTime(request.responded_at) : ''],
  ]
  return (
    <SheetModal
      visible
      tall
      title={td(request.title)}
      subtitle={`${t('store.requests.requestId')} #${request.id} · ${counterpartName}`}
      onClose={onClose}
      footer={request.can_respond ? (
        <View style={styles.actions}>
          <ActionButton small tone="outline" icon={X} label={t('store.requests.reject')} disabled={busy} onPress={() => act(() => respondStoreBuilderRequest(request.id, 'REJECT', response.trim()), 'store.sbr.rejected')} />
          <ActionButton small icon={Check} label={t('store.sbr.accept')} disabled={busy} onPress={() => act(() => respondStoreBuilderRequest(request.id, 'ACCEPT', response.trim()), 'store.sbr.accepted')} />
        </View>
      ) : request.can_withdraw ? (
        <View style={styles.actions}>
          <ActionButton small tone="outline" icon={Undo2} label={t('store.sbr.withdraw')} disabled={busy} onPress={() => act(() => withdrawStoreBuilderRequest(request.id), 'store.sbr.withdrawn')} />
        </View>
      ) : null}
    >
      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.fact}>
            <Text style={styles.factLabel}>{t(label)}</Text>
            <Text style={styles.factValue} numberOfLines={2}>{value || '—'}</Text>
          </View>
        ))}
        <View style={styles.fact}>
          <Text style={styles.factLabel}>{t('store.col.status')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 2 }}><StatusPill status={request.status} /></View>
        </View>
      </View>
      <View style={styles.box}>
        <Text style={styles.title}>{td(request.title)}</Text>
        <Text style={styles.body}>{td(request.description)}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.factLabel}>{t('store.sbr.response')}</Text>
        <Text style={styles.body}>{request.response ? td(request.response) : t(request.status === 'PENDING' ? 'store.sbr.awaitingResponse' : 'store.sbr.noResponseText')}</Text>
      </View>
      {request.can_respond ? (
        <LabeledInput label={t('store.sbr.yourResponse')} value={response} onChangeText={setResponse} maxLength={1000} multiline placeholder={t('store.sbr.responsePh')} />
      ) : null}
    </SheetModal>
  )
}

export default function StoreBuilderRequestsPanel({ data, failed, reload }) {
  const { t, td } = useLanguage()
  const [tab, setTab] = useState('received')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  if (!data) {
    return <View style={styles.panel}><Text style={styles.meta}>{t(failed ? 'store.sbr.loadFailed' : 'store.sbr.loading')}</Text></View>
  }
  const text = SIDE_TEXT[data.side] || SIDE_TEXT.BUILDER
  const requests = data.requests || []
  const counterparts = data.counterparts || []
  const received = requests.filter((request) => !request.sent_by_me)
  const sent = requests.filter((request) => request.sent_by_me)
  const shown = tab === 'received' ? received : sent
  const open = requests.find((request) => request.id === openId) || null
  const counterpartName = (request) => td(data.side === 'STORE_MANAGER' ? request.builder_name : request.store_manager_name)

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.panel}>
        <View style={styles.head}>
          <Text style={styles.panelTitle}>{t(tab === 'received' ? text.received : text.sent)}</Text>
          <ActionButton small icon={Plus} label={t(text.newRequest)} disabled={!counterparts.length} onPress={() => setCreating(true)} />
        </View>
        <SegmentTabs
          tabs={[{ id: 'received', label: t(text.received), count: received.length }, { id: 'sent', label: t(text.sent), count: sent.length }]}
          active={tab}
          onChange={setTab}
        />
        {!counterparts.length ? <Text style={styles.amber}>{t(text.noCounterpart)}</Text> : null}
        {shown.length ? shown.map((request) => (
          <Pressable key={request.id} onPress={() => setOpenId(request.id)} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.code}>{`#${request.id}`}</Text>
              <Text style={[styles.meta, { flex: 1 }]} numberOfLines={1}>{formatDateTime(request.created_at)}</Text>
              <StatusPill status={request.status} />
            </View>
            <Text style={styles.title} numberOfLines={2}>{td(request.title)}</Text>
            <Text style={styles.meta} numberOfLines={1}>{`${counterpartName(request)} · ${t(`store.sbr.category.${request.category}`)}`}</Text>
            {request.response ? <Text style={styles.meta} numberOfLines={2}>{`${t('store.sbr.response')}: ${td(request.response)}`}</Text> : null}
            <View style={styles.viewRow}>
              <View style={styles.viewButton}>
                <Eye size={12} color={COLORS.slate[600]} />
                <Text style={styles.viewText}>{t(request.can_respond ? 'store.sbr.respond' : 'store.viewDetails')}</Text>
              </View>
            </View>
          </Pressable>
        )) : (
          <View style={styles.empty}>
            <Inbox size={24} color={COLORS.slate[400]} />
            <Text style={styles.meta}>{t(tab === 'received' ? 'store.sbr.noneReceived' : 'store.sbr.noneSent')}</Text>
          </View>
        )}
      </View>
      {open ? (
        <RequestDetailSheet key={open.id} request={open} text={text} counterpartName={counterpartName(open)} onChanged={reload} onClose={() => setOpenId(null)} />
      ) : null}
      {creating ? (
        <NewRequestSheet
          text={text}
          counterparts={counterparts}
          onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); setTab('sent'); toast.success(t('store.sbr.sent')); reload() }}
        />
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  panel: { gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelTitle: { flexShrink: 1, fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: c.text },
  amber: { overflow: 'hidden', borderRadius: 8, backgroundColor: soft('#fffbeb', '#92400e'), paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: '700', color: ink('#92400e') },  card: { gap: 4, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 13, fontWeight: '800', color: c.text },
  title: { fontSize: 13.5, fontWeight: '800', color: c.text },
  meta: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  body: { marginTop: 4, fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: c.textSoft },
  viewRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  viewButton: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 8 },
  viewText: { fontSize: 11, fontWeight: '800', color: c.textSoft },
  empty: { alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingVertical: 26 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  label: { marginBottom: 4, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textSoft },
  chipRow: { marginBottom: 12, flexDirection: 'row' },
  chipInvalid: { marginBottom: 4, alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: '#dc2626' },
  fieldError: { marginBottom: 12, fontSize: 11.5, fontWeight: '600', color: '#dc2626' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
  fact: { width: '50%', paddingRight: 6 },
  factLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  factValue: { fontSize: 12.5, fontWeight: '700', color: c.text },
  box: { marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
}))