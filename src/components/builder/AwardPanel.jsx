// Port of web components/dashboard/AwardPanel.jsx, from the BUILDER's side.
//
// One project's builder assignment — or, before the owner assigns, the
// negotiation with this builder (`award.assigned === false`): its status, the
// amounts on the table, the offer history and the actions the SERVER allows
// (`award.actions`). Every amount-bearing action sends the amount on screen, so
// a stale screen gets a 409 and reloads instead of agreeing to something else.
// 'assign' / 'unassign' are the owner's and are never drawn here.
// Strings come from the web award.* keys (mobile-only ones: mobile.dashboard.*).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { View, Text, ActivityIndicator } from 'react-native'
import { CircleCheckBig, CircleX, Clock, FileText, Lock, MessageSquare, CircleAlert } from 'lucide-react-native'
import {
  acceptAwardOffer, cancelAward, confirmAwardContract, declineAward, fetchProjectAward, rejectAwardOffer, submitAwardOffer,
} from '../../api/requests'
import { formatMoney } from '../../utils/countryConfig'
import { awardWorkStartedUnconfirmed } from '../../utils/awardFlow'
import { ActionButton, ConfirmDialog, LabeledInput, Notice } from './BuilderUi'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'

const OFFER_STATUS = { open: 'award.offerStatus.open', accepted: 'award.offerStatus.accepted', rejected: 'award.offerStatus.rejected', superseded: 'award.offerStatus.superseded', withdrawn: 'award.offerStatus.withdrawn' }

function errorText(error, fallback) {
  const detail = error?.response?.data?.detail
  if (detail?.message) return detail.message
  if (typeof detail === 'string') return detail
  return fallback
}

const stamp = (value) => {
  if (!value) return ''
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function OfferTimeline({ offers, money }) {
  const { t } = useLanguage()
  return (
    <View style={styles.view}>
      {offers.map((offer) => (
        <View key={offer.id} style={styles.view2}>
          <View style={[styles.view3, styles[offer.proposed_by === 'owner' ? 'view4' : 'view5']]} />
          <View style={styles.actionButton}>
            <Text style={styles.text}>
              {t(offer.proposed_by === 'owner' ? 'award.byOwner' : 'award.byBuilder')} · {offer.proposer_name || '—'}
            </Text>
            <Text style={styles.text2}>{offer.note || '—'}</Text>
            {offer.created_at ? <Text style={styles.text3}>{stamp(offer.created_at)}</Text> : null}
          </View>
          <View style={styles.view6}>
            <Text style={styles.text4}>{money(offer.amount)}</Text>
            <Text style={styles.text5}>
              {OFFER_STATUS[offer.status] ? t(OFFER_STATUS[offer.status]) : offer.status}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

export default function AwardPanel({ projectId, requestId = null, onChanged, onLoaded }) {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [showCounter, setShowCounter] = useState(false)
  const [counterAmount, setCounterAmount] = useState('')
  const [counterNote, setCounterNote] = useState('')
  const latest = useRef(0)
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  // Latest load wins, so an overlapping reload cannot be overwritten by an older answer.
  const load = useCallback(async () => {
    const call = ++latest.current
    try {
      const response = await fetchProjectAward(projectId, requestId)
      if (call !== latest.current) return
      setData(response)
      onLoadedRef.current?.(response)
    } catch {
      if (call === latest.current) setData(null)
    } finally {
      if (call === latest.current) setLoading(false)
    }
  }, [projectId, requestId])

  useEffect(() => { load() }, [load])
  useLiveRefresh(load)
  // The owner's counter-offer, acceptance or assignment shows without a manual
  // refresh: the live hint above, plus this re-read as a fallback when the
  // socket is down (the web also keeps its timed refresh).
  useEffect(() => {
    const timer = setInterval(() => { load() }, 15000)
    return () => clearInterval(timer)
  }, [load])

  const award = data?.award
  if (loading) {
    return (
      <View style={styles.view7}>
        <ActivityIndicator size="small" color="#134127" />
        <Text style={styles.text6}>{t('award.loading')}</Text>
      </View>
    )
  }
  if (!award) return null

  const money = (value) => formatMoney(value, award.project_country)
  const agreed = money(award.agreed_amount)
  const openOffer = award.open_offer
  const actions = (award.actions || []).filter((action) => action !== 'assign' && action !== 'unassign')
  const isBuilder = award.viewer !== 'owner'
  const actionRequired = Boolean(award.action_required_by) && award.action_required_by === award.viewer
  const releaseBlocked = Boolean(award.release_blocked_reason)
  const workStartedUnconfirmed = awardWorkStartedUnconfirmed(award)
  const negotiationOnly = award.assigned === false

  const phaseText = award.locked
    ? t('request.flow.ongoing')
    : workStartedUnconfirmed
      ? t('award.status.work_started_unconfirmed')
      : award.phase === 'quotation_agreed'
        ? t('award.status.final_your_confirmation', { amount: agreed })
        : award.phase === 'quotation_open'
          ? t('award.status.quotation_your_confirmation', { amount: agreed })
          : award.phase === 'builder_confirmed'
            ? t('award.status.builder_confirmed', { amount: agreed })
            : award.phase === 'amount_agreed'
              ? t('award.status.amount_agreed', { amount: agreed })
              : award.phase === 'contract_confirmed'
                ? t('award.status.contract_confirmed', { amount: money(award.contract_amount ?? award.agreed_amount) })
                : {
                  assignment_pending: t('award.status.assignment_pending'),
                  negotiating: t('award.status.negotiating'),
                  declined: t('award.status.declined'),
                  cancelled: t('award.status.cancelled'),
                }[award.phase] || String(award.phase || '').toUpperCase()

  const run = async (action) => {
    setBusy(true)
    setMessage('')
    try {
      await action()
      setDialog(null)
      setShowCounter(false)
      setCounterAmount('')
      setCounterNote('')
      await load()
      onChanged?.()
    } catch (error) {
      setMessage(errorText(error, t('award.error')))
      // A changed amount or state: show the current one.
      if (error?.response?.status === 409) await load()
    } finally {
      setBusy(false)
    }
  }

  const submitCounter = () => {
    const amount = Number(String(counterAmount).replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage(t('award.form.invalidAmount'))
      return
    }
    run(() => submitAwardOffer(award.id, amount, counterNote.trim()))
  }

  const openIsMine = Boolean(openOffer) && openOffer.proposed_by === award.viewer
  const myPrevious = [...(award.offers || [])].reverse().find((offer) => offer.proposed_by === award.viewer && offer.id !== openOffer?.id)
  const theirCurrent = openOffer && !openIsMine ? openOffer.amount : award.agreed_amount

  let headline = null
  if (!award.locked) {
    if (award.phase === 'negotiating' && openOffer) {
      headline = openIsMine
        ? { label: t('award.headline.yourOffer'), amount: openOffer.amount, sub: t('award.waitingOwner') }
        : { label: t(openOffer.proposed_by === 'owner' ? 'award.headline.ownerCounter' : 'award.headline.builderCounter'), amount: openOffer.amount, action: true }
    } else if (award.phase === 'quotation_agreed') {
      headline = { label: t('award.headline.quotationAccepted'), amount: award.agreed_amount, sub: t('award.confirmFinalQuotationSub'), action: true }
    } else if (award.phase === 'builder_confirmed') {
      headline = { label: t('award.headline.builderConfirmed'), amount: award.agreed_amount, sub: t('award.awaitingOwnerAssignment') }
    } else if (award.phase === 'amount_agreed') {
      headline = { label: t('award.headline.assignedToYou'), amount: award.agreed_amount, sub: t('award.awaitingYourConfirmation'), action: true }
    } else if (award.phase === 'contract_confirmed') {
      headline = { label: t('award.headline.contractConfirmed'), amount: award.contract_amount ?? award.agreed_amount, done: true }
    }
  }

  const ended = award.phase === 'declined' || award.phase === 'cancelled'
  const banner = award.locked
    ? { box: 'tone', dot: '#64748b', Icon: Lock }
    : headline?.done
      ? { box: 'view8', dot: '#059669', Icon: CircleCheckBig }
      : ended
        ? { box: 'tone2', dot: '#ef4444', Icon: CircleX }
        : actionRequired
          ? { box: 'view9', dot: '#f59e0b', Icon: CircleAlert }
          : { box: 'tone3', dot: '#0284c7', Icon: Clock }
  const BannerIcon = banner.Icon
  const instructions = [
    award.locked ? t('award.lockedNote') : null,
    award.locked ? award.locked_reason : null,
    actionRequired && isBuilder && award.phase === 'assignment_pending' && !workStartedUnconfirmed ? t('award.awaitingYourDecision') : null,
    workStartedUnconfirmed ? t('award.workStartedBuilderNote', { amount: agreed }) : null,
    actionRequired && isBuilder && award.phase === 'quotation_open' ? t('award.confirmFinalQuotationSub') : null,
    award.action_required_by && !actionRequired && !headline?.sub
      ? t(award.action_required_by === 'owner' ? 'award.waitingOwner' : 'award.waitingBuilder')
      : null,
  ].filter(Boolean)

  const amountRows = [
    [t('dash.common.originalBudget'), award.original_budget > 0 ? money(award.original_budget) : t('dash.common.notSet')],
    [t('award.originalQuotation'), money(award.original_quotation)],
    ...(award.agreed_offer_id ? [[t(negotiationOnly ? 'award.agreedQuotation' : 'award.headline.amountAgreed'), agreed]] : []),
    ...(award.contract_amount != null ? [[t('dash.common.contractValue'), money(award.contract_amount)]] : []),
  ]

  const dialogCopy = dialog ? {
    confirm: negotiationOnly
      ? { title: t('award.dialog.confirmQuotationTitle'), body: t('award.dialog.confirmQuotationBody', { amount: agreed }), button: t('award.confirmQuotation', { amount: agreed }), tone: 'primary', run: () => confirmAwardContract(award.id, award.agreed_amount) }
      : { title: t('award.dialog.confirmTitle'), body: t('award.dialog.confirmBody', { amount: agreed }), button: t('award.confirmContract', { amount: agreed }), tone: 'primary', run: () => confirmAwardContract(award.id, award.agreed_amount) },
    decline: negotiationOnly
      ? { title: t('award.dialog.withdrawTitle'), body: t(award.phase === 'builder_confirmed' ? 'award.dialog.withdrawConfirmedBody' : 'award.dialog.withdrawBody'), button: t('award.withdraw'), tone: 'danger', run: () => declineAward(award.id) }
      : { title: t('award.dialog.rejectTitle'), body: t('award.dialog.rejectBody'), button: t('award.reject'), tone: 'danger', run: () => declineAward(award.id) },
    cancel: negotiationOnly
      ? { title: t('award.dialog.cancelNegotiationTitle'), body: t('mobile.dashboard.award.cancelNegotiationBody'), button: t('award.cancelNegotiation'), tone: 'danger', run: () => cancelAward(award.id) }
      : { title: t('award.dialog.cancelTitle'), body: t('mobile.dashboard.award.cancelBody'), button: t('award.cancel'), tone: 'danger', run: () => cancelAward(award.id) },
  }[dialog] : null

  return (
    <View>
      {/* Status banner */}
      <View style={[styles.view10, styles[banner.box]]}>
        <View style={[styles.view11, { backgroundColor: banner.dot }]}>
          <BannerIcon size={14} color="#fff" />
        </View>
        <View style={styles.actionButton}>
          <Text style={styles.text7}>{t(negotiationOnly ? 'award.titleNegotiation' : 'award.title')}</Text>
          <Text style={styles.text4}>
            {actionRequired ? <Text style={styles.text8}>{t('award.actionRequired')} · </Text> : null}
            {phaseText}
          </Text>
          {instructions.map((line) => (
            <Text key={line} style={styles.text9}>{line}</Text>
          ))}
        </View>
      </View>

      {/* Amounts */}
      <View style={styles.view12}>
        <Text style={styles.text10}>{t('dash.common.amount')}</Text>
        <View style={styles.view13}>
          {amountRows.map(([label, value]) => (
            <View key={label}>
              <Text style={styles.text11}>{label}</Text>
              <Text style={styles.text4}>{value}</Text>
            </View>
          ))}
        </View>
        {headline ? (
          <View style={[styles.view14, styles[headline.done ? 'view8' : headline.action ? 'view9' : 'view15']]}>
            <Text style={styles.text12}>{headline.label}</Text>
            <Text style={styles.text13}>{money(headline.amount)}</Text>
            {headline.sub ? <Text style={styles.text14}>{headline.sub}</Text> : null}
          </View>
        ) : null}
        {openOffer?.note ? (
          <Text style={styles.text15}>
            <Text style={styles.text16}>{t('award.form.reason')}: </Text>{openOffer.note}
          </Text>
        ) : null}
      </View>

      {/* Actions — exactly the ones the server allows */}
      {actions.length > 0 ? (
        <View style={styles.view16}>
          {isBuilder && actions.includes('confirm') ? (
            <ActionButton
              icon={FileText}
              disabled={busy}
              onPress={() => setDialog('confirm')}
              label={negotiationOnly
                ? t('award.confirmQuotation', { amount: agreed })
                : award.phase === 'amount_agreed' || workStartedUnconfirmed ? t('award.confirmContract', { amount: agreed }) : t('award.agree', { amount: agreed })}
            />
          ) : null}
          {actions.includes('accept_offer') && openOffer ? (
            <ActionButton icon={CircleCheckBig} disabled={busy} label={t('award.acceptOffer', { amount: money(openOffer.amount) })} onPress={() => run(() => acceptAwardOffer(openOffer.id, openOffer.amount))} />
          ) : null}
          {actions.includes('reject_offer') && openOffer ? (
            <ActionButton icon={CircleX} tone="outline" disabled={busy} label={t('award.rejectOffer')} onPress={() => run(() => rejectAwardOffer(openOffer.id))} />
          ) : null}
          {actions.includes('counter') ? (
            <ActionButton
              icon={MessageSquare}
              tone="outline"
              disabled={busy}
              label={openOffer ? t('award.counterAgain') : t('award.negotiate')}
              onPress={() => setShowCounter((open) => !open)}
            />
          ) : null}
          {actions.includes('decline') ? (
            <ActionButton icon={CircleX} tone="danger" disabled={busy || releaseBlocked} label={t(negotiationOnly ? 'award.withdraw' : 'award.reject')} onPress={() => setDialog('decline')} />
          ) : null}
          {actions.includes('cancel') ? (
            <ActionButton icon={CircleX} tone="danger" disabled={busy || releaseBlocked} label={t(negotiationOnly ? 'award.cancelNegotiation' : 'award.cancel')} onPress={() => setDialog('cancel')} />
          ) : null}
          {releaseBlocked && (actions.includes('decline') || actions.includes('cancel')) ? (
            <Text style={styles.text17}>{award.release_blocked_reason}</Text>
          ) : null}
        </View>
      ) : null}

      {showCounter ? (
        <View style={styles.view17}>
          <Text style={styles.text18}>{t('award.form.title')}</Text>
          <Text style={styles.text19}>
            {openOffer && !openIsMine ? t('award.form.ownerOffer') : t('award.currentAgreed')}: <Text style={styles.text20}>{money(theirCurrent)}</Text>
            {myPrevious ? <Text> · {t('award.form.yourPrevious')}: <Text style={styles.text20}>{money(myPrevious.amount)}</Text></Text> : null}
          </Text>
          <LabeledInput label={t('award.form.proposedAmount')} value={counterAmount} onChangeText={(value) => setCounterAmount(value.replace(/[^\d.]/g, ''))} keyboardType="numeric" placeholder={t('dash.common.amount')} />
          {Number(counterAmount) > 0 ? <Text style={styles.text21}>{money(counterAmount)}</Text> : null}
          <LabeledInput label={t('award.form.reason')} value={counterNote} onChangeText={setCounterNote} multiline maxLength={1000} placeholder={t('mobile.dashboard.award.reasonPlaceholder')} />
          <View style={styles.view18}>
            <ActionButton label={t('dash.common.cancel')} tone="outline" disabled={busy} onPress={() => setShowCounter(false)} style={styles.actionButton} />
            <ActionButton label={t('award.form.submit')} busy={busy} onPress={submitCounter} style={styles.actionButton} />
          </View>
        </View>
      ) : null}

      {message ? <View style={styles.view19}><Notice tone="info" text={message} /></View> : null}

      {/* History */}
      <View style={styles.view20}>
        <Text style={styles.text4}>{t('award.history')}</Text>
        {(award.offers || []).length === 0
          ? <Text style={styles.text22}>{t('award.noHistory')}</Text>
          : <OfferTimeline offers={award.offers} money={money} />}
        {(award.earlier_rounds || []).length > 0 ? (
          <View style={styles.view21}>
            <Text style={styles.text18}>{t('award.earlierRounds')}</Text>
            {award.earlier_rounds.map((round, index) => (
              <View key={round.award_id} style={styles.view22}>
                <Text style={styles.text23}>
                  {t('award.roundLabel', { n: index + 1 })} · {t(round.status === 'declined' ? 'award.roundDeclined' : 'award.roundCancelled')}
                </Text>
                <Text style={styles.text11}>{t('award.roundAgreed', { amount: money(round.agreed_amount) })}{round.ended_at ? ` · ${stamp(round.ended_at)}` : ''}</Text>
                {round.offers?.length
                  ? <OfferTimeline offers={round.offers} money={money} />
                  : <Text style={styles.text24}>{t('award.roundNoOffers')}</Text>}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <ConfirmDialog
        visible={Boolean(dialogCopy)}
        title={dialogCopy?.title}
        body={dialogCopy?.body}
        rows={[
          [t('award.project'), award.project_title],
          [t('award.owner'), award.owner_name],
          [t(dialog === 'confirm' ? 'award.dialog.agreedAmount' : 'award.currentAgreed'), agreed],
        ]}
        confirmLabel={dialogCopy?.button}
        tone={dialogCopy?.tone}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => dialogCopy && run(dialogCopy.run)}
      />
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { marginTop: 7 },
  view2: { flexDirection: 'row', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  view3: { marginTop: 3.5, height: 10.5, width: 10.5, borderRadius: 9999, borderWidth: 2, borderColor: '#236645' },
  view4: { backgroundColor: c.card },
  view5: { backgroundColor: '#236645' },
  actionButton: { flex: 1 },
  text: { fontSize: 13, fontWeight: '700', color: c.text },
  text2: { fontSize: 12, lineHeight: 16, color: c.textMuted },
  text3: { marginTop: 1.75, fontSize: 10, color: c.textFaint },
  view6: { alignItems: 'flex-end' },
  text4: { fontSize: 13, fontWeight: '800', color: c.text },
  text5: { marginTop: 1.75, borderRadius: 9999, backgroundColor: c.muted, paddingHorizontal: 7, paddingVertical: 1.75, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: c.textMuted },
  view7: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10.5 },
  text6: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  tone: { borderColor: c.border, backgroundColor: c.subtle },
  view8: { borderColor: c.emeraldBorder, backgroundColor: c.emeraldSoft },
  tone2: { borderColor: c.redBorder, backgroundColor: c.redSoft },
  view9: { borderColor: c.amberBorder, backgroundColor: c.amberSoft },
  tone3: { borderColor: c.skyBorder, backgroundColor: c.skySoft },
  view10: { flexDirection: 'row', alignItems: 'flex-start', gap: 8.75, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view11: { height: 24.5, width: 24.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  text7: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: c.textMuted },
  text8: { color: c.redText },
  text9: { marginTop: 1.75, fontSize: 12, lineHeight: 16, color: c.textMuted },
  view12: { marginTop: 10.5, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text10: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.brandTextStrong },
  view13: { marginTop: 5.25, flexDirection: 'row', flexWrap: 'wrap', columnGap: 17.5, rowGap: 7 },
  text11: { fontSize: 11, color: c.textMuted },
  view14: { marginTop: 8.75, alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8.75, paddingVertical: 5.25 },
  view15: { borderColor: c.brandBorder, backgroundColor: c.brandSoft },
  text12: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.brandTextStrong },
  text13: { fontSize: 15, fontWeight: '800', color: c.text },
  text14: { marginTop: 1.75, fontSize: 11, fontWeight: '600', color: c.textSecondary },
  text15: { marginTop: 7, borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 8.75, paddingVertical: 3.5, fontSize: 12, lineHeight: 16, color: c.textMuted },
  text16: { fontWeight: '700' },
  view16: { marginTop: 10.5, gap: 7 },
  text17: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.amberTextStrong },
  view17: { marginTop: 10.5, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10.5 },
  text18: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: c.textMuted },
  text19: { marginBottom: 7, marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  text20: { fontWeight: '800', color: c.text },
  text21: { marginTop: -7, marginBottom: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.text },
  view18: { flexDirection: 'row', gap: 7 },
  view19: { marginTop: 10.5 },
  view20: { marginTop: 10.5, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  text22: { marginTop: 7, fontSize: 12, lineHeight: 16, color: c.textMuted },
  view21: { marginTop: 10.5, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 7 },
  view22: { marginTop: 7, borderRadius: 8, backgroundColor: c.subtle, padding: 8.75 },
  text23: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.text },
  text24: { marginTop: 3.5, fontSize: 11, color: c.textMuted },
}))
