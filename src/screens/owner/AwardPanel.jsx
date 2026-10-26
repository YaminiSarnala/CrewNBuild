// Port of the web components/dashboard/AwardPanel.jsx and
// NegotiateQuotationModal.jsx.
//
// AwardPanel: one project's builder assignment -- or, before the owner assigns,
// the negotiation with one builder (`award.assigned` false): its status, the
// amounts on the table, the offer history and the actions this viewer may take.
// The server decides which actions are allowed (`award.actions`); this only
// renders them. Every amount-bearing action sends the amount on screen, so a
// stale screen gets a 409 and reloads instead of agreeing to something else.
// Assigning is not here: it lives in the project's Assign Builder tab.
import { useCallback, useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import Dialog, { DialogButton, DialogRow } from '../../components/Dialog'
import { BudgetInWords, FormNotice, TextField } from '../../components/form'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatMoney } from '../../utils/countryConfig'
import { formatDateTime } from '../../utils/formatters'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import {
  acceptAwardOffer, cancelAward, confirmAwardContract, declineAward, fetchProjectAward, rejectAwardOffer, submitAwardOffer,
} from '../../api/requests'
import { createStyles } from '../../theme/createStyles'

const PHASE_TONE = {
  assignment_pending: { box: 'tone', text: 'tone2' },
  negotiating: { box: 'tone3', text: 'tone4' },
  quotation_open: { box: 'tone3', text: 'tone4' },
  quotation_agreed: { box: 'tone', text: 'tone2' },
  amount_agreed: { box: 'tone5', text: 'tone6' },
  contract_confirmed: { box: 'tone7', text: 'tone8' },
  declined: { box: 'tone9', text: 'tone10' },
  cancelled: { box: 'tone11', text: 'tone12' },
}

export function awardErrorText(error, fallback) {
  const detail = error?.response?.data?.detail
  if (detail?.message) return detail.message
  if (typeof detail === 'string') return detail
  return fallback
}

const amountText = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

// The owner's "Negotiate" on a quotation not assigned yet: the assignment and
// the opening counter-offer go in one request (/project-requests/assign with
// offer_amount), so a refused offer never leaves the builder assigned.
export function NegotiateDialog({ visible, quotation, builderName, budget, country = 'India', onSubmit, onClose }) {
  const { t, td } = useLanguage()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const money = (value) => formatMoney(value, country)

  useEffect(() => {
    if (visible) {
      setAmount('')
      setNote('')
      setMessage('')
    }
  }, [visible])

  const submit = async () => {
    const value = Number(amount)
    if (amount === '' || !Number.isFinite(value) || value <= 0) {
      setMessage(t('award.form.invalidAmount'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await onSubmit(value, note.trim())
      onClose()
    } catch (error) {
      setMessage(awardErrorText(error, t('award.error')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      visible={visible}
      busy={busy}
      onClose={onClose}
      title={t('award.form.title')}
      subtitle={builderName ? td(builderName) : null}
      footer={(
        <>
          <DialogButton look="secondary" label={t('dash.common.cancel')} onPress={onClose} disabled={busy} />
          <DialogButton label={t('award.form.submit')} onPress={submit} disabled={busy} />
        </>
      )}
    >
      <View style={styles.view}>
        <DialogRow label={t('request.flow.builderQuotation')} value={money(quotation)} strong />
        <DialogRow label={t('award.negotiateModal.yourBudget')} value={Number(budget) > 0 ? money(budget) : t('dash.common.notSet')} />
      </View>
      <TextField
        containerStyle={{ marginTop: 12, marginBottom: 4 }}
        label={t('award.negotiateModal.yourCounter')}
        value={amount}
        onChangeText={(value) => setAmount(amountText(value))}
        keyboardType="decimal-pad"
        autoFocus
      />
      {Number(amount) > 0 ? <Text style={[styles.text, { fontSize: 12 }]}>{money(amount)}</Text> : null}
      <BudgetInWords value={amount} country={country} style={{ marginTop: 0 }} />
      <TextField label={t('award.form.reason')} value={note} onChangeText={setNote} multiline maxLength={1000} style={{ minHeight: 64 }} />
      <Text style={[styles.text2, { fontSize: 12, lineHeight: 17 }]}>{t('award.negotiateModal.body')}</Text>
      <FormNotice message={message} tone="error" style={{ marginTop: 10 }} />
    </Dialog>
  )
}

export default function AwardPanel({ projectId, requestId = null, onChanged }) {
  const { t, td } = useLanguage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [showCounter, setShowCounter] = useState(false)
  const [counterAmount, setCounterAmount] = useState('')
  const [counterNote, setCounterNote] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await fetchProjectAward(projectId, requestId))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, requestId])

  useEffect(() => { load() }, [load])
  // The other side's counter-offer, acceptance or confirmation shows at once.
  useLiveRefresh(load)

  const award = data?.award
  if (loading) return <Text style={[styles.text3, { fontSize: 12 }]}>{t('award.loading')}</Text>
  if (!award) return null

  const money = (value) => formatMoney(value, award.project_country)
  const agreed = money(award.agreed_amount)
  const openOffer = award.open_offer
  const actions = award.actions || []
  const isBuilder = award.viewer === 'builder'
  const actionRequired = award.action_required_by && award.action_required_by === award.viewer
  const releaseBlocked = Boolean(award.release_blocked_reason)
  // Not assigned yet: the panel is a negotiation, and its words say so.
  const negotiationOnly = award.assigned === false
  const phaseText = award.locked
    ? t('request.flow.ongoing')
    : award.phase === 'quotation_agreed'
      ? t(isBuilder ? 'award.status.awaiting_owner_assignment' : 'award.status.ready_to_assign', { amount: agreed })
      : award.phase === 'amount_agreed'
        ? t('award.status.amount_agreed', { amount: agreed })
        : award.phase === 'contract_confirmed'
          ? t('award.status.contract_confirmed', { amount: money(award.contract_amount ?? award.agreed_amount) })
          : t(`award.status.${award.phase}`)

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
      setMessage(awardErrorText(error, t('award.error')))
      // A changed amount or state: show the current one.
      if (error?.response?.status === 409) await load()
    } finally {
      setBusy(false)
    }
  }

  const submitCounter = () => {
    const amount = Number(counterAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage(t('award.form.invalidAmount'))
      return
    }
    run(() => submitAwardOffer(award.id, amount, counterNote.trim()))
  }

  const openIsMine = Boolean(openOffer) && openOffer.proposed_by === award.viewer
  const myPrevious = [...(award.offers || [])].reverse().find((offer) => offer.proposed_by === award.viewer && offer.id !== openOffer?.id)
  const theirCurrent = openOffer && !openIsMine ? openOffer.amount : award.agreed_amount

  // One line saying where the negotiation stands, in business terms.
  let headline = null
  if (!award.locked) {
    if (award.phase === 'negotiating' && openOffer) {
      headline = openIsMine
        ? { label: t('award.headline.yourOffer'), amount: openOffer.amount, sub: t(isBuilder ? 'award.waitingOwner' : 'award.waitingBuilder') }
        : { label: t(openOffer.proposed_by === 'owner' ? 'award.headline.ownerCounter' : 'award.headline.builderCounter'), amount: openOffer.amount, action: true }
    } else if (award.phase === 'quotation_agreed') {
      headline = { label: t('award.headline.quotationAccepted'), amount: award.agreed_amount, sub: t(isBuilder ? 'award.awaitingOwnerAssignment' : 'award.readyToAssign'), action: !isBuilder }
    } else if (award.phase === 'amount_agreed') {
      headline = {
        label: isBuilder ? t('award.headline.assignedToYou') : t('award.headline.assignedTo', { name: td(award.builder_name) }),
        amount: award.agreed_amount,
        sub: t(isBuilder ? 'award.awaitingYourConfirmation' : 'award.awaitingBuilderConfirmation'),
        action: isBuilder,
      }
    } else if (award.phase === 'contract_confirmed') {
      headline = { label: t('award.headline.contractConfirmed'), amount: award.contract_amount ?? award.agreed_amount, done: true }
    }
  }

  const rows = [
    [t('award.project'), td(award.project_title)],
    [t('award.owner'), td(award.owner_name)],
    [t('award.builder'), td(award.builder_name)],
    [t('dash.common.originalBudget'), award.original_budget > 0 ? money(award.original_budget) : t('dash.common.notSet')],
    [t('award.originalQuotation'), money(award.original_quotation)],
    // Only an amount both sides actually agreed; until then it is the quotation above.
    ...(award.agreed_offer_id ? [[t(negotiationOnly ? 'award.agreedQuotation' : 'award.headline.amountAgreed'), agreed, true]] : []),
    ...(award.contract_amount != null ? [[t('dash.common.contractValue'), money(award.contract_amount), true]] : []),
  ]

  const tone = PHASE_TONE[award.locked ? 'contract_confirmed' : award.phase] || PHASE_TONE.cancelled
  const headlineBox = headline?.done ? 'tone7' : headline?.action ? 'tone' : 'tone13'

  // One dialog for every decision; a negotiation that was never assigned is
  // withdrawn or cancelled, not "rejected" or "unassigned".
  const copy = dialog ? {
    confirm: { title: 'award.dialog.confirmTitle', body: t('award.dialog.confirmBody', { amount: agreed }), party: 'owner', amount: 'award.dialog.agreedAmount' },
    decline: negotiationOnly
      ? { title: 'award.dialog.withdrawTitle', body: t('award.dialog.withdrawBody'), party: 'owner', amount: 'award.currentAgreed' }
      : { title: 'award.dialog.rejectTitle', body: t('award.dialog.rejectBody'), party: 'owner', amount: 'award.currentAgreed' },
    cancel: negotiationOnly
      ? { title: 'award.dialog.cancelNegotiationTitle', body: t('award.dialog.cancelNegotiationBody'), party: 'builder', amount: 'award.currentAgreed' }
      : { title: 'award.dialog.cancelTitle', body: t('award.dialog.cancelBody'), party: 'builder', amount: 'award.currentAgreed' },
  }[dialog] : null

  return (
    <View style={styles.view2}>
      <View style={[styles.view3, { gap: 8 }]}>
        <View style={[styles.view4, { minWidth: 140 }]}>
          <Text style={[styles.text4, { fontSize: 10.5, letterSpacing: 0.6 }]}>
            {t(negotiationOnly ? 'award.titleNegotiation' : 'award.title')}
          </Text>
          <Text style={[styles.text5, { fontSize: 15 }]}>{td(award.project_title)}</Text>
        </View>
        <View style={[styles.view5, { gap: 6 }]}>
          {actionRequired ? (
            <View style={styles.view6}>
              <Text style={[styles.text6, { fontSize: 10 }]}>{t('award.actionRequired')}</Text>
            </View>
          ) : null}
          <View style={[styles.view7, styles[tone.box]]}>
            <Text style={[styles.text7, styles[tone.text], { fontSize: 10 }]}>{phaseText}</Text>
          </View>
        </View>
      </View>

      {award.action_required_by && !actionRequired && !headline?.sub ? (
        <Text style={[styles.text8, { fontSize: 12 }]}>
          {t(award.action_required_by === 'owner' ? 'award.waitingOwner' : 'award.waitingBuilder')}
        </Text>
      ) : null}

      {headline ? (
        <View style={[styles.view8, styles[headlineBox]]}>
          <Text style={[styles.text4, { fontSize: 10.5 }]}>{headline.label}</Text>
          <Text style={[styles.text9, { fontSize: 19 }]}>{money(headline.amount)}</Text>
          {headline.sub ? <Text style={[styles.text3, { fontSize: 12 }]}>{headline.sub}</Text> : null}
        </View>
      ) : null}

      {award.locked ? (
        <View style={styles.view9}>
          <Text style={[styles.text10, { fontSize: 11 }]}>{t('award.lockedNote')}</Text>
          {award.locked_reason ? <Text style={[styles.text11, { fontSize: 11 }]}>{award.locked_reason}</Text> : null}
        </View>
      ) : null}

      <View style={styles.view}>
        {rows.map(([label, value, strong]) => (
          <View key={label} style={[styles.view10, { gap: 12 }]}>
            <Text style={[styles.text2, { fontSize: 12 }]}>{label}</Text>
            <Text style={[styles.text12, strong ? styles.text13 : styles.text14, { fontSize: 13 }]}>{value}</Text>
          </View>
        ))}
      </View>

      {openOffer?.note ? (
        <Text style={[styles.text15, { fontSize: 12 }]}>
          <Text style={styles.text13}>{t('award.form.reason')}: </Text>{td(openOffer.note)}
        </Text>
      ) : null}

      {actions.length > 0 ? (
        <View style={[styles.view11, { gap: 8 }]}>
          {isBuilder && actions.includes('confirm') ? (
            <DialogButton
              label={award.phase === 'amount_agreed' ? t('award.confirmContract', { amount: agreed }) : t('award.agree', { amount: agreed })}
              onPress={() => setDialog('confirm')}
              disabled={busy}
            />
          ) : null}
          {actions.includes('accept_offer') && openOffer ? (
            <DialogButton
              label={t('award.acceptOffer', { amount: money(openOffer.amount) })}
              onPress={() => run(() => acceptAwardOffer(openOffer.id, openOffer.amount))}
              disabled={busy}
            />
          ) : null}
          {actions.includes('reject_offer') && openOffer ? (
            <DialogButton look="secondary" label={t('award.rejectOffer')} onPress={() => run(() => rejectAwardOffer(openOffer.id))} disabled={busy} />
          ) : null}
          {actions.includes('counter') ? (
            <DialogButton
              look="secondary"
              label={isBuilder ? (openOffer ? t('award.counterAgain') : t('award.negotiate')) : t('award.counter')}
              onPress={() => setShowCounter((open) => !open)}
              disabled={busy}
            />
          ) : null}
          {actions.includes('decline') ? (
            <DialogButton look="danger" label={t(negotiationOnly ? 'award.withdraw' : 'award.reject')} onPress={() => setDialog('decline')} disabled={busy || releaseBlocked} />
          ) : null}
          {actions.includes('cancel') ? (
            <DialogButton look="danger" label={t(negotiationOnly ? 'award.cancelNegotiation' : 'award.cancel')} onPress={() => setDialog('cancel')} disabled={busy || releaseBlocked} />
          ) : null}
        </View>
      ) : null}
      {releaseBlocked && (actions.includes('decline') || actions.includes('cancel')) ? (
        <Text style={[styles.text16, { fontSize: 12 }]}>{award.release_blocked_reason}</Text>
      ) : null}

      {showCounter ? (
        <View style={styles.view12}>
          <Text style={[styles.text4, { fontSize: 10.5 }]}>{t('award.form.title')}</Text>
          <Text style={[styles.text17, { fontSize: 12 }]}>
            {isBuilder && !(openOffer && !openIsMine) ? t('award.currentAgreed') : t(isBuilder ? 'award.form.ownerOffer' : 'award.form.builderOffer')}
            {': '}
            <Text style={styles.text18}>{money(theirCurrent)}</Text>
            {myPrevious ? (
              <>
                {` · ${t('award.form.yourPrevious')}: `}
                <Text style={styles.text18}>{money(myPrevious.amount)}</Text>
              </>
            ) : null}
          </Text>
          <TextField
            containerStyle={{ marginTop: 10, marginBottom: 4 }}
            label={t('award.form.proposedAmount')}
            value={counterAmount}
            onChangeText={(value) => setCounterAmount(amountText(value))}
            keyboardType="decimal-pad"
          />
          {Number(counterAmount) > 0 ? <Text style={[styles.text19, { fontSize: 12 }]}>{money(counterAmount)}</Text> : null}
          <TextField label={t('award.form.reason')} value={counterNote} onChangeText={setCounterNote} multiline maxLength={1000} style={{ minHeight: 60 }} />
          <View style={[styles.view13, { gap: 8 }]}>
            <DialogButton label={t('award.form.submit')} onPress={submitCounter} disabled={busy} />
            <DialogButton look="secondary" label={t('dash.common.cancel')} onPress={() => setShowCounter(false)} disabled={busy} />
          </View>
        </View>
      ) : null}

      <FormNotice message={message} tone="error" style={{ marginTop: 10 }} />

      <View style={styles.view}>
        <Text style={[styles.text4, { fontSize: 10.5 }]}>{t('award.history')}</Text>
        {!award.offers?.length ? (
          <Text style={[styles.text20, { fontSize: 12 }]}>{t('award.noHistory')}</Text>
        ) : (
          <View style={[styles.view14, { gap: 6 }]}>
            {award.offers.map((offer) => (
              <View key={offer.id} style={styles.view15}>
                <View style={[styles.view16, { gap: 8 }]}>
                  <Text style={[styles.text21, { fontSize: 12 }]} numberOfLines={1}>
                    {`${t(offer.proposed_by === 'owner' ? 'award.byOwner' : 'award.byBuilder')} · ${td(offer.proposer_name)}`}
                  </Text>
                  <Text style={[styles.text18, { fontSize: 12.5 }]}>{money(offer.amount)}</Text>
                </View>
                <View style={[styles.view17, { gap: 8 }]}>
                  <Text style={[styles.text22, { fontSize: 11.5 }]}>{offer.note ? td(offer.note) : '—'}</Text>
                  <Text style={[styles.text4, { fontSize: 10.5 }]}>
                    {t(`award.offerStatus.${offer.status}`)}{offer.created_at ? ` · ${formatDateTime(`${offer.created_at}Z`)}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <Dialog
        visible={Boolean(dialog)}
        busy={busy}
        onClose={() => setDialog(null)}
        title={copy ? t(copy.title) : ''}
        footer={copy ? (
          <>
            <DialogButton look="secondary" label={t('award.dialog.back')} onPress={() => setDialog(null)} disabled={busy} />
            {dialog === 'confirm' ? (
              <DialogButton label={t('award.confirmContract', { amount: agreed })} onPress={() => run(() => confirmAwardContract(award.id, award.agreed_amount))} disabled={busy} />
            ) : null}
            {dialog === 'decline' ? (
              <DialogButton look="danger" label={t(negotiationOnly ? 'award.withdraw' : 'award.reject')} onPress={() => run(() => declineAward(award.id))} disabled={busy} />
            ) : null}
            {dialog === 'cancel' ? (
              <DialogButton look="danger" label={t(negotiationOnly ? 'award.cancelNegotiation' : 'award.cancel')} onPress={() => run(() => cancelAward(award.id))} disabled={busy} />
            ) : null}
          </>
        ) : null}
      >
        {copy ? (
          <>
            <View style={styles.view}>
              <DialogRow label={t('award.project')} value={td(award.project_title)} />
              <DialogRow label={t(copy.party === 'builder' ? 'award.builder' : 'award.owner')} value={td(copy.party === 'builder' ? award.builder_name : award.owner_name)} />
              <DialogRow label={t(copy.amount)} value={agreed} strong />
            </View>
            <Text style={[styles.text23, { fontSize: 13, lineHeight: 19 }]}>{copy.body}</Text>
          </>
        ) : null}
      </Dialog>
    </View>
  )
}

const styles = createStyles((c) => ({
  tone: { backgroundColor: c.amberSoft, borderColor: c.amberBorder },
  tone2: { color: c.amberTextStrong },
  tone3: { backgroundColor: c.skySoft, borderColor: c.skyBorder },
  tone4: { color: c.skyTextStrong },
  tone5: { backgroundColor: c.violetSoft, borderColor: c.violetBorder },
  tone6: { color: c.violetTextStrong },
  tone7: { backgroundColor: c.emeraldSoft, borderColor: c.emeraldBorder },
  tone8: { color: c.emeraldTextStrong },
  tone9: { backgroundColor: c.redSoft, borderColor: c.redBorder },
  tone10: { color: c.redText },
  tone11: { backgroundColor: c.muted, borderColor: c.border },
  tone12: { color: c.textSoft },
  view: { marginTop: 10.5 },
  text: { marginBottom: 3.5, fontFamily: 'Inter_700Bold', color: c.text },
  text2: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  text3: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  tone13: { backgroundColor: c.subtle, borderColor: c.border },
  view2: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  view3: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' },
  view4: { flex: 1 },
  text4: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textMuted },
  text5: { marginTop: 1.75, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view5: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  view6: { borderRadius: 9999, backgroundColor: '#dc2626', paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text6: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: '#ffffff' },
  view7: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text7: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  text8: { marginTop: 7, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view8: { marginTop: 10.5, borderRadius: 10.5, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text9: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view9: { marginTop: 7, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  text10: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.text },
  text11: { marginTop: 1.75, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view10: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 5.25 },
  text12: { flex: 1, textAlign: 'right', color: c.text },
  text13: { fontFamily: 'Inter_700Bold' },
  text14: { fontFamily: 'Inter_600SemiBold' },
  text15: { marginTop: 7, borderRadius: 10.5, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view11: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap' },
  text16: { marginTop: 7, fontFamily: 'Inter_600SemiBold', color: c.amberTextStrong },
  view12: { marginTop: 10.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10.5 },
  text17: { marginTop: 3.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  text18: { fontFamily: 'Inter_700Bold', color: c.text },
  text19: { marginBottom: 7, fontFamily: 'Inter_700Bold', color: c.text },
  view13: { flexDirection: 'row', flexWrap: 'wrap' },
  text20: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view14: { marginTop: 3.5 },
  view15: { borderRadius: 10.5, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5, paddingVertical: 7 },
  view16: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text21: { flex: 1, fontFamily: 'Inter_700Bold', color: c.text },
  view17: { marginTop: 1.75, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  text22: { flex: 1, fontFamily: 'Inter_400Regular', color: c.textMuted },
  text23: { marginTop: 10.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
}))
