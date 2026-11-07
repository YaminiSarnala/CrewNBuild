// Port of web subscription/BuilderSubscriptionPanel.jsx — the Builder's
// "Plan & billing" page. Everything shown comes from the server
// (GET /subscriptions/me, GET /subscriptions/plans); a plan becomes active only
// after the server has verified the payment.
//
// Payment on mobile, as on the web:
//   - The server's local mock gateway (no Razorpay TEST keys configured):
//     create the order, then simulate success / failure / cancel and verify.
//   - A live Razorpay order opens Razorpay Standard Checkout in the app (the
//     web's checkout.js and options, in a WebView: RazorpayCheckoutModal), then
//     verifies with the server. Only if Checkout cannot load at all does the
//     builder finish on the web Plan & billing page in the system browser.
// Strings use the web panel's translation keys (subscription.*, payments.mock*).
import { useEffect, useState } from 'react'
import { View, Text, TextInput } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { BadgeCheck, CalendarDays, Check, FlaskConical, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react-native'
import { Panel } from '../../components/DashboardShell'
import {
  ActionButton, InfoRow, Notice, PremiumBadge, Section, StackScreenShell, SheetModal,
} from '../../components/builder/BuilderUi'
import useBuilderSubscription, { announceSubscriptionChange } from '../../hooks/useBuilderSubscription'
import {
  createSubscriptionOrder, fetchSubscriptionPlans, reportSubscriptionFailure,
  simulateSubscriptionCheckout, validateSubscriptionCoupon, verifySubscriptionPayment, WEB_SUBSCRIPTION_URL,
} from '../../api/subscription'
import {
  CARD_BADGES, IN_FORCE, OFFERS, annualSaving, durationName, formatPlanDate, formatRupees,
  isEndingSoon, offerCardLines, offerName, offerPrice, paymentStatusName, planAction, planCardLines, quoteForOffer, quoteMatchesOffer,
  statusName, subscriptionErrorMessage,
} from '../../utils/subscriptionFormat'
import { COLORS } from '../../theme/tokens'
import RazorpayCheckoutModal from '../../components/builder/RazorpayCheckoutModal'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'

/** The card's mark (web PlanCards Mark): PREMIUM shield, or the PRO / PLUS pill. */
function PlanMark({ badge }) {
  const { t } = useLanguage()
  if (badge === 'PREMIUM') {
    return (
      <View style={styles.markPremium}>
        <ShieldCheck size={11} color="#fcd34d" />
        <Text style={styles.markPremiumText}>{t('subscription.badge.PREMIUM')}</Text>
      </View>
    )
  }
  if (badge === 'PRO' || badge === 'PLUS') {
    return (
      <View style={styles.markPro}>
        <BadgeCheck size={11} color="#ffffff" />
        <Text style={styles.markProText}>{t(`subscription.badge.${badge}`)}</Text>
      </View>
    )
  }
  return null
}

export default function BuilderSubscriptionScreen({ navigation }) {
  const { t } = useLanguage()
  const subscription = useBuilderSubscription()
  const { status, loading, error, refresh } = subscription
  const [catalogue, setCatalogue] = useState(null)
  const [busyPlan, setBusyPlan] = useState('')
  const [notice, setNotice] = useState(null)
  const [mockOrder, setMockOrder] = useState(null)
  const [simulating, setSimulating] = useState(false)
  // A live Razorpay order being paid in the in-app Checkout.
  const [liveOrder, setLiveOrder] = useState(null)
  const [couponInput, setCouponInput] = useState('')
  const [couponQuote, setCouponQuote] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)

  const loadCatalogue = () => fetchSubscriptionPlans()
    .then(setCatalogue)
    .catch((failure) => {
      setCatalogue({ plans: [] })
      setNotice({ tone: 'error', text: subscriptionErrorMessage(failure, t('subscription.plans.loadFailed')) })
    })

  useEffect(() => { loadCatalogue() }, [])

  const finish = async (tone, text) => {
    setBusyPlan('')
    setMockOrder(null)
    setNotice({ tone, text })
    await refresh()
    announceSubscriptionChange()
  }

  const verify = async (order, response) => {
    try {
      const result = await verifySubscriptionPayment({
        subscriptionPaymentId: order.subscription_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      })
      setCouponQuote(null)
      setCouponInput('')
      const active = result?.subscription
      await finish('success', active?.coverage_end
        ? t('subscription.panel.activatedUntil', { plan: offerName(active.plan_code, active.current_period?.duration_code, t), date: formatPlanDate(active.coverage_end) })
        : t('subscription.panel.activated'))
    } catch (failure) {
      await finish('error', subscriptionErrorMessage(failure, t('subscription.panel.failed')))
    }
  }

  const fail = async (order, details) => {
    try {
      await reportSubscriptionFailure({ subscriptionPaymentId: order.subscription_payment_id, ...details })
    } catch { /* informational only */ }
    await finish('error', t('subscription.panel.failed'))
  }

  /** Fallback only: Checkout could not load in the app, so pay on the web page and re-read here. */
  const payOnWeb = async () => {
    setNotice({ tone: 'info', text: t('mobile.billing.payOnWeb') })
    try {
      await WebBrowser.openBrowserAsync(WEB_SUBSCRIPTION_URL)
    } catch {
      setBusyPlan('')
      setNotice({ tone: 'error', text: t('subscription.panel.checkoutUnavailable') })
      return
    }
    setBusyPlan('')
    await refresh()
    announceSubscriptionChange()
  }

  const purchase = async (planCode, durationCode) => {
    setNotice(null)
    setBusyPlan(`${planCode}:${durationCode}`)
    let order
    try {
      // The coupon goes only with the plan it is for; the server re-prices it.
      const code = quoteMatchesOffer(couponQuote, planCode, durationCode) ? couponQuote.code : null
      order = await createSubscriptionOrder(planCode, durationCode, code)
    } catch (failure) {
      setBusyPlan('')
      setNotice({ tone: 'error', text: subscriptionErrorMessage(failure, t('subscription.panel.failed')) })
      return
    }
    if (order.gateway_mode === 'mock') {
      setMockOrder(order)
      return
    }
    setLiveOrder(order)
  }

  const closeLive = () => setLiveOrder(null)

  const simulate = async (outcome) => {
    const order = mockOrder
    if (!order || simulating) return
    if (outcome === 'cancel') { await finish('info', t('subscription.panel.cancelled')); return }
    setSimulating(true)
    try {
      const result = await simulateSubscriptionCheckout(order.subscription_payment_id, outcome)
      if (outcome === 'success') await verify(order, result)
      else await fail(order, { code: result.error_code, description: result.error_description, razorpayPaymentId: result.razorpay_payment_id })
    } catch (failure) {
      await finish('error', subscriptionErrorMessage(failure, t('subscription.panel.failed')))
    } finally {
      setSimulating(false)
    }
  }

  const applyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponBusy(true)
    setCouponError('')
    try {
      setCouponQuote(await validateSubscriptionCoupon(couponInput.trim()))
    } catch (failure) {
      setCouponQuote(null)
      setCouponError(subscriptionErrorMessage(failure, t('subscription.coupon.invalid')))
    } finally {
      setCouponBusy(false)
    }
  }

  const inForce = status && IN_FORCE.includes(status.status)
  const current = status?.current_period
  const quoteOffers = OFFERS.filter((offer) => quoteMatchesOffer(couponQuote, offer.planCode, offer.durationCode))
  const saving = annualSaving(catalogue)

  return (
    <StackScreenShell
      title={t('subscription.panel.title')}
      subtitle={t('subscription.plans.testMode')}
      onBack={() => navigation.goBack()}
      refreshing={loading && !!status}
      onRefresh={() => { refresh(); loadCatalogue() }}
      right={<PremiumBadge status={status} />}
    >
      <Panel title={t('subscription.summary.title')} action={<ActionButton small tone="outline" icon={RefreshCw} label={t('subscription.panel.refresh')} onPress={refresh} disabled={loading} />}>
        {error && !status ? <Notice tone="error" text={subscriptionErrorMessage(error, t('subscription.panel.loadFailed'))} /> : null}
        {status ? (
          <>
            <InfoRow label={t('subscription.panel.currentPlan')} value={inForce ? offerName(status.plan_code, current?.duration_code, t) : t('subscription.plan.FREE')} strong />
            <InfoRow label={t('dash.common.status')} value={statusName(status.status, t)} />
            <InfoRow label={t('subscription.panel.billingPeriod')} value={current ? durationName(current.duration_code, t) : '—'} />
            {current ? <InfoRow label={t('mobile.billing.started')} value={formatPlanDate(current.period_start)} /> : null}
            <InfoRow
              label={t('subscription.panel.validity')}
              value={status.status === 'EXPIRED'
                ? t('subscription.panel.expiredOn', { date: formatPlanDate(status.coverage_end) })
                : inForce ? t('subscription.panel.validUntil', { date: formatPlanDate(status.coverage_end) }) : '—'}
            />
            {status.status === 'GRACE' ? <Text style={styles.text}>{t('subscription.panel.graceUntil', { date: formatPlanDate(status.grace_until) })}</Text> : null}
            {(status.queued_periods || []).map((period) => (
              <Text key={period.id} style={styles.text2}>{t('subscription.panel.renewalQueued', { date: formatPlanDate(period.period_start) })}</Text>
            ))}
            {status.status === 'TRIAL' && status.free_access_until ? (
              <Text style={styles.text3}>{t('mobile.billing.freeMonthUntil', { date: formatPlanDate(status.free_access_until) })}</Text>
            ) : null}
          </>
        ) : null}
        {status?.status === 'EXPIRED' ? (
          <View style={styles.view}>
            <TriangleAlert size={15} color="#be123c" />
            <Text style={styles.text4}>{t('subscription.panel.expiredMessage')}</Text>
          </View>
        ) : null}
        {isEndingSoon(status) ? (
          <View style={styles.view2}>
            <TriangleAlert size={15} color="#b45309" />
            <Text style={styles.text5}>{t('subscription.panel.expiringSoon', { date: formatPlanDate(status.coverage_end) })}</Text>
          </View>
        ) : null}
        {notice ? <View style={styles.actionButton}><Notice tone={notice.tone} text={notice.text} /></View> : null}
      </Panel>

      <Panel title={t('subscription.panel.choosePlan')}>
        {status?.region_supported === false ? <Notice tone="info" text={t('subscription.panel.regionUnavailable')} /> : null}
        <Text style={styles.text6}>
          {t('subscription.panel.activationNote')}
        </Text>
        {inForce ? <Text style={styles.text7}>{t('subscription.panel.changeRestriction')}</Text> : null}

        {/* Coupon */}
        <View style={styles.view3}>
          <Text style={styles.text8}>{t('subscription.coupon.label')}</Text>
          <View style={styles.view4}>
            <TextInput
              value={couponInput}
              onChangeText={(value) => setCouponInput(value.toUpperCase())}
              placeholder={t('subscription.coupon.placeholder')}
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="characters"
              editable={!couponQuote}
              style={styles.textInput}
            />
            {couponQuote ? (
              <ActionButton small tone="outline" label={t('subscription.coupon.remove')} onPress={() => { setCouponQuote(null); setCouponInput(''); setCouponError('') }} />
            ) : (
              <ActionButton small label={couponBusy ? t('subscription.coupon.checking') : t('subscription.coupon.apply')} busy={couponBusy} disabled={!couponInput.trim()} onPress={applyCoupon} />
            )}
          </View>
          {couponQuote && quoteOffers.length > 0 ? (
            <Text style={styles.text9}>{t('subscription.coupon.applied', { code: couponQuote.code, plan: quoteOffers.map((offer) => t(`subscription.offer.${offer.id}.name`)).join(', ') })}</Text>
          ) : null}
          {couponError ? <Text style={styles.text10}>{couponError}</Text> : null}
        </View>

        {/* Four cards, as on the web (PlanCards): Free, Pro, Plus and Premium.
            Each lists its plan's locations, leads per location and camera
            quality from the server's catalogue; each paid card is one option. */}
        <View style={[styles.planCard, styles.planCardFree]}>
          <View style={[styles.planBar, { backgroundColor: '#e2e8f0' }]} />
          <Text style={styles.planName}>{t('subscription.plan.FREE')}</Text>
          <Text style={styles.planPrice}>{formatRupees(0)}</Text>
          <Text style={styles.planAccess}>{t('subscription.price.noBilling')}</Text>
          <Text style={styles.planIncluded}>{t('subscription.inherits.FREE')}</Text>
          {planCardLines(catalogue, 'FREE').map(({ key, values }) => (
            <View key={key} style={styles.planLine}>
              <Check size={15} color={COLORS.slate[400]} />
              <Text style={styles.planLineText}>{t(key, values)}</Text>
            </View>
          ))}
          <Text style={styles.freeIncluded}>{t('subscription.included')}</Text>
        </View>

        {OFFERS.map((offer) => {
          const price = offerPrice(catalogue, offer)
          const action = planAction(offer.planCode, status, price)
          const key = `${offer.planCode}:${offer.durationCode}`
          const disabled = action === 'unavailable' || action === 'blocked' || Boolean(busyPlan)
          const name = t(`subscription.offer.${offer.id}.name`)
          const label = busyPlan === key ? t('subscription.panel.processing')
            : action === 'renew' ? t('subscription.cta.renewOption', { duration: name })
              : action === 'blocked' ? t('subscription.cta.afterCurrent')
                : action === 'unavailable' ? t('subscription.cta.unavailable')
                  : t('subscription.cta.chooseNamed', { plan: name })
          const coupon = quoteForOffer(couponQuote, offer.planCode, offer.durationCode)
          const isCurrent = status && ['ACTIVE', 'GRACE'].includes(status.status)
            && status.plan_code === offer.planCode && current?.duration_code === offer.durationCode
          const pro = offer.id === 'PRO_MONTHLY'
          return (
            <View key={offer.id} style={[styles.planCard, pro ? styles.planCardPro : styles.planCardPremium]}>
              {/* The web's top strip: green on Pro, slate-to-gold on Plus and Premium. */}
              {pro ? <View style={[styles.planBar, { backgroundColor: '#10b981' }]} /> : (
                <View style={[styles.planBar, { flexDirection: 'row' }]}>
                  <View style={{ flex: 2, backgroundColor: '#0f172a' }} />
                  <View style={{ flex: 1, backgroundColor: '#334155' }} />
                  <View style={{ flex: 1, backgroundColor: '#fbbf24' }} />
                </View>
              )}
              <View style={styles.planHead}>
                <Text style={styles.planName}>{name}</Text>
                <PlanMark badge={CARD_BADGES[offer.id]} />
                {isCurrent ? (
                  <View style={styles.currentPill}><Text style={styles.currentPillText}>{t('subscription.cta.current')}</Text></View>
                ) : null}
              </View>
              {price ? (
                <>
                  <View style={styles.planPriceRow}>
                    <Text style={[styles.planPrice, { marginTop: 0 }]}>{formatRupees(price)}</Text>
                    {catalogue?.test_mode ? (
                      <View style={styles.testPill}>
                        <FlaskConical size={11} color="#92400e" />
                        <Text style={styles.testPillText}>{t('subscription.price.testBadge')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.planAccessRow}>
                    <CalendarDays size={13} color={COLORS.slate[400]} />
                    <Text style={[styles.planAccess, { marginTop: 0 }]}>{t(`subscription.offer.${offer.id}.access`)}</Text>
                  </View>
                  {offer.id === 'PREMIUM_ANNUAL' && saving ? (
                    <View style={styles.savingPill}>
                      <Text style={styles.savingPillText}>{t('subscription.offer.annualSaving', { amount: formatRupees(saving.saving), full: formatRupees(saving.full) })}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.planPrice, { fontSize: 18, color: COLORS.slate[400] }]}>{t('subscription.price.notSet')}</Text>
              )}
              <Text style={styles.planIncluded}>{t('subscription.compare.included')}</Text>
              {offerCardLines(catalogue, offer).map(({ key: lineKey, values }) => (
                <View key={lineKey} style={styles.planLine}>
                  <Check size={15} color={pro ? '#059669' : COLORS.graphite} />
                  <Text style={styles.planLineText}>{t(lineKey, values)}</Text>
                </View>
              ))}
              {coupon ? (
                <View style={styles.view10}>
                  <InfoRow label={t('subscription.coupon.original')} value={formatRupees(coupon.original_amount_paise)} />
                  <InfoRow label={`${t('subscription.coupon.discount')} (${coupon.code || couponQuote?.code || ''})`} value={`− ${formatRupees(coupon.discount_paise)}`} />
                  <InfoRow label={t('subscription.coupon.final')} value={formatRupees(coupon.final_amount_paise)} strong />
                </View>
              ) : null}
              {/* One look for every paid plan's button, as on the web. */}
              <ActionButton
                label={label}
                tone="success"
                disabled={disabled}
                busy={busyPlan === key}
                onPress={() => purchase(offer.planCode, offer.durationCode)}
                style={styles.actionButton}
              />
            </View>
          )
        })}
      </Panel>

      <Panel title={t('subscription.panel.history')}>
        {!status?.history?.length ? (
          <Text style={styles.text28}>{t('subscription.panel.noHistory')}</Text>
        ) : status.history.map((row) => (
          <View key={row.id} style={styles.view11}>
            <View style={styles.view12}>
              <Text style={styles.text29}>{offerName(row.plan_code, row.duration_code, t)}</Text>
              <Text style={styles.text29}>{formatRupees(row.amount_paise)}</Text>
            </View>
            <Text style={styles.text30}>
              {durationName(row.duration_code, t)} · {formatPlanDate(row.period_start)} – {formatPlanDate(row.period_end)}
            </Text>
            <Text style={styles.text31}>
              {paymentStatusName(row.status === 'REVOKED' ? 'REFUNDED' : row.payment_status, t)}
            </Text>
          </View>
        ))}
      </Panel>

      <Section>
        <Text style={styles.text32}>{t('mobile.billing.serverDecides')}</Text>
      </Section>

      {/* Live Razorpay Checkout (TEST keys on the server). */}
      <RazorpayCheckoutModal
        order={liveOrder}
        description={liveOrder ? `${offerName(liveOrder.plan_code, liveOrder.duration_code, t)} · ${durationName(liveOrder.duration_code, t)}` : ''}
        onSuccess={(response) => { const order = liveOrder; closeLive(); verify(order, response) }}
        onFailure={({ code, description, paymentId }) => { const order = liveOrder; closeLive(); fail(order, { code, description, razorpayPaymentId: paymentId }) }}
        onDismiss={() => { closeLive(); finish('info', t('subscription.panel.cancelled')) }}
        onUnavailable={() => { closeLive(); payOnWeb() }}
      />

      {/* The server's local mock gateway (no Razorpay TEST keys yet). */}
      <SheetModal
        visible={!!mockOrder}
        title={t('payments.mockTitle')}
        subtitle={mockOrder ? `${offerName(mockOrder.plan_code, mockOrder.duration_code, t)} · ${durationName(mockOrder.duration_code, t)}` : ''}
        onClose={() => { if (!simulating) simulate('cancel') }}
      >
        <Text style={styles.text33}>
          {t('payments.mockExplain')}
        </Text>
        <Text style={styles.text34}>{formatRupees(mockOrder?.amount_paise)}</Text>
        <View style={styles.view13}>
          <ActionButton tone="success" label={t('payments.mockSuccess')} busy={simulating} disabled={simulating} onPress={() => simulate('success')} />
          <ActionButton tone="danger" label={t('payments.mockFailure')} disabled={simulating} onPress={() => simulate('failure')} />
          <ActionButton tone="outline" label={t('payments.mockCancel')} disabled={simulating} onPress={() => simulate('cancel')} />
        </View>
      </SheetModal>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  text: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.amberText },
  text2: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  text3: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.skyText },
  view: { marginTop: 10.5, flexDirection: 'row', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text4: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.roseTextStrong },
  view2: { marginTop: 10.5, flexDirection: 'row', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: c.amberBorder, backgroundColor: c.amberSoft, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text5: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.amberTextStrong },
  actionButton: { marginTop: 14 },
  planCard: { marginTop: 14, overflow: 'hidden', borderRadius: 16, borderWidth: 1, backgroundColor: c.card, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  planCardFree: { borderColor: c.border },
  planCardPro: { borderColor: '#6ee7b7' },
  planCardPremium: { borderColor: '#cbd5e1' },
  planBar: { position: 'absolute', top: 0, right: 0, left: 0, height: 4, overflow: 'hidden' },
  planHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  planName: { fontSize: 17, fontWeight: '800', color: c.text },
  planPriceRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 7 },
  planPrice: { marginTop: 12, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: c.text },
  planAccessRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  planAccess: { marginTop: 6, fontSize: 12, fontWeight: '700', color: c.textMuted },
  planIncluded: { marginTop: 16, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: c.textMuted },
  planLine: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  planLineText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: c.textSecondary },
  freeIncluded: { marginTop: 14, overflow: 'hidden', borderRadius: 8, backgroundColor: c.subtle, paddingVertical: 11, textAlign: 'center', fontSize: 12, fontWeight: '700', color: c.textMuted },
  currentPill: { marginLeft: 'auto', borderRadius: 9999, backgroundColor: '#059669', paddingHorizontal: 8, paddingVertical: 2 },
  currentPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#ffffff' },
  testPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 9999, backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2 },
  testPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#92400e' },
  savingPill: { marginTop: 8, alignSelf: 'flex-start', borderRadius: 9999, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 2 },
  savingPillText: { fontSize: 11, fontWeight: '800', color: '#065f46' },
  markPremium: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#0f172a', paddingHorizontal: 6, paddingVertical: 2 },
  markPremiumText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: '#fcd34d' },
  markPro: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 9999, backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 2 },
  markProText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: '#ffffff' },
  text6: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  text7: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  view3: { marginTop: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.subtle, padding: 10.5 },
  text8: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  view4: { flexDirection: 'row', gap: 7 },
  textInput: { height: 35, flex: 1, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.text },
  text9: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.emeraldText },
  text10: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.roseTextSoft },
  view10: { marginTop: 10.5, borderRadius: 8, borderWidth: 1, borderColor: c.emeraldBorder, backgroundColor: c.emeraldSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  text28: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  view11: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  view12: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text29: { fontSize: 13, fontWeight: '800', color: c.text },
  text30: { marginTop: 1.75, fontSize: 12, lineHeight: 16, color: c.textMuted },
  text31: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  text32: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: c.textFaint },
  text33: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  text34: { marginTop: 10.5, fontSize: 20, lineHeight: 28, fontWeight: '800', color: c.text },
  view13: { marginTop: 14, gap: 7 },
}))
