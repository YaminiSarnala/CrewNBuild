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
    <View className="mt-2">
      {offers.map((offer) => (
        <View key={offer.id} className="flex-row gap-3 border-b border-slate-100 py-2.5">
          <View className={`mt-1 h-3 w-3 rounded-full border-2 border-brand-600 ${offer.proposed_by === 'owner' ? 'bg-white' : 'bg-brand-600'}`} />
          <View className="flex-1">
            <Text className="text-[13px] font-bold text-graphite">
              {t(offer.proposed_by === 'owner' ? 'award.byOwner' : 'award.byBuilder')} · {offer.proposer_name || '—'}
            </Text>
            <Text className="text-xs text-slate-500">{offer.note || '—'}</Text>
            {offer.created_at ? <Text className="mt-0.5 text-[10px] text-slate-400">{stamp(offer.created_at)}</Text> : null}
          </View>
          <View className="items-end">
            <Text className="text-[13px] font-extrabold text-graphite">{money(offer.amount)}</Text>
            <Text className="mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
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
      <View className="flex-row items-center gap-2 py-3">
        <ActivityIndicator size="small" color="#134127" />
        <Text className="text-xs font-semibold text-slate-500">{t('award.loading')}</Text>
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
    ? { box: 'border-slate-200 bg-slate-50', dot: '#64748b', Icon: Lock }
    : headline?.done
      ? { box: 'border-emerald-200 bg-emerald-50', dot: '#059669', Icon: CircleCheckBig }
      : ended
        ? { box: 'border-red-200 bg-red-50', dot: '#ef4444', Icon: CircleX }
        : actionRequired
          ? { box: 'border-amber-200 bg-amber-50', dot: '#f59e0b', Icon: CircleAlert }
          : { box: 'border-sky-200 bg-sky-50', dot: '#0284c7', Icon: Clock }
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
      <View className={`flex-row items-start gap-2.5 rounded-xl border px-3 py-2.5 ${banner.box}`}>
        <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: banner.dot }}>
          <BannerIcon size={14} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-[10px] font-bold uppercase text-slate-500">{t(negotiationOnly ? 'award.titleNegotiation' : 'award.title')}</Text>
          <Text className="text-[13px] font-extrabold text-graphite">
            {actionRequired ? <Text className="text-red-700">{t('award.actionRequired')} · </Text> : null}
            {phaseText}
          </Text>
          {instructions.map((line) => (
            <Text key={line} className="mt-0.5 text-xs text-slate-500">{line}</Text>
          ))}
        </View>
      </View>

      {/* Amounts */}
      <View className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <Text className="text-xs font-extrabold text-brand-800">{t('dash.common.amount')}</Text>
        <View className="mt-1.5 flex-row flex-wrap gap-x-5 gap-y-2">
          {amountRows.map(([label, value]) => (
            <View key={label}>
              <Text className="text-[11px] text-slate-500">{label}</Text>
              <Text className="text-[13px] font-extrabold text-graphite">{value}</Text>
            </View>
          ))}
        </View>
        {headline ? (
          <View className={`mt-2.5 self-start rounded-lg border px-2.5 py-1.5 ${headline.done ? 'border-emerald-200 bg-emerald-50' : headline.action ? 'border-amber-200 bg-amber-50' : 'border-brand-100 bg-brand-50'}`}>
            <Text className="text-[10px] font-extrabold uppercase text-brand-800">{headline.label}</Text>
            <Text className="text-[15px] font-extrabold text-graphite">{money(headline.amount)}</Text>
            {headline.sub ? <Text className="mt-0.5 text-[11px] font-semibold text-slate-600">{headline.sub}</Text> : null}
          </View>
        ) : null}
        {openOffer?.note ? (
          <Text className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
            <Text className="font-bold">{t('award.form.reason')}: </Text>{openOffer.note}
          </Text>
        ) : null}
      </View>

      {/* Actions — exactly the ones the server allows */}
      {actions.length > 0 ? (
        <View className="mt-3 gap-2">
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
            <Text className="text-xs font-semibold text-amber-800">{award.release_blocked_reason}</Text>
          ) : null}
        </View>
      ) : null}

      {showCounter ? (
        <View className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Text className="text-[11px] font-extrabold uppercase text-slate-500">{t('award.form.title')}</Text>
          <Text className="mb-2 mt-1 text-xs font-semibold text-slate-500">
            {openOffer && !openIsMine ? t('award.form.ownerOffer') : t('award.currentAgreed')}: <Text className="font-extrabold text-graphite">{money(theirCurrent)}</Text>
            {myPrevious ? <Text> · {t('award.form.yourPrevious')}: <Text className="font-extrabold text-graphite">{money(myPrevious.amount)}</Text></Text> : null}
          </Text>
          <LabeledInput label={t('award.form.proposedAmount')} value={counterAmount} onChangeText={(value) => setCounterAmount(value.replace(/[^\d.]/g, ''))} keyboardType="numeric" placeholder={t('dash.common.amount')} />
          {Number(counterAmount) > 0 ? <Text className="-mt-2 mb-2 text-xs font-bold text-graphite">{money(counterAmount)}</Text> : null}
          <LabeledInput label={t('award.form.reason')} value={counterNote} onChangeText={setCounterNote} multiline maxLength={1000} placeholder={t('mobile.dashboard.award.reasonPlaceholder')} />
          <View className="flex-row gap-2">
            <ActionButton label={t('dash.common.cancel')} tone="outline" disabled={busy} onPress={() => setShowCounter(false)} className="flex-1" />
            <ActionButton label={t('award.form.submit')} busy={busy} onPress={submitCounter} className="flex-1" />
          </View>
        </View>
      ) : null}

      {message ? <View className="mt-3"><Notice tone="info" text={message} /></View> : null}

      {/* History */}
      <View className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <Text className="text-[13px] font-extrabold text-graphite">{t('award.history')}</Text>
        {(award.offers || []).length === 0
          ? <Text className="mt-2 text-xs text-slate-500">{t('award.noHistory')}</Text>
          : <OfferTimeline offers={award.offers} money={money} />}
        {(award.earlier_rounds || []).length > 0 ? (
          <View className="mt-3 border-t border-slate-100 pt-2">
            <Text className="text-[11px] font-extrabold uppercase text-slate-500">{t('award.earlierRounds')}</Text>
            {award.earlier_rounds.map((round, index) => (
              <View key={round.award_id} className="mt-2 rounded-lg bg-slate-50 p-2.5">
                <Text className="text-xs font-bold text-graphite">
                  {t('award.roundLabel', { n: index + 1 })} · {t(round.status === 'declined' ? 'award.roundDeclined' : 'award.roundCancelled')}
                </Text>
                <Text className="text-[11px] text-slate-500">{t('award.roundAgreed', { amount: money(round.agreed_amount) })}{round.ended_at ? ` · ${stamp(round.ended_at)}` : ''}</Text>
                {round.offers?.length
                  ? <OfferTimeline offers={round.offers} money={money} />
                  : <Text className="mt-1 text-[11px] text-slate-500">{t('award.roundNoOffers')}</Text>}
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