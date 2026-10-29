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
import { CreditCard, RefreshCw, TriangleAlert } from 'lucide-react-native'
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
  FREE_FEATURE_KEYS, IN_FORCE, OFFERS, annualSaving, durationName, formatPlanDate, formatRupees,
  isEndingSoon, offerFeatureLines, offerName, offerPrice, paymentStatusName, planAction, quoteForOffer, quoteMatchesOffer,
  statusName, subscriptionErrorMessage,
} from '../../utils/subscriptionFormat'
import { COLORS } from '../../theme/tokens'
import RazorpayCheckoutModal from '../../components/builder/RazorpayCheckoutModal'
import { useLanguage } from '../../i18n/LanguageContext'

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
            {status.status === 'GRACE' ? <Text className="mt-2 text-xs font-bold text-amber-700">{t('subscription.panel.graceUntil', { date: formatPlanDate(status.grace_until) })}</Text> : null}
            {(status.queued_periods || []).map((period) => (
              <Text key={period.id} className="mt-1 text-xs font-semibold text-slate-500">{t('subscription.panel.renewalQueued', { date: formatPlanDate(period.period_start) })}</Text>
            ))}
            {status.status === 'TRIAL' && status.free_access_until ? (
              <Text className="mt-2 text-xs font-bold text-sky-700">{t('mobile.billing.freeMonthUntil', { date: formatPlanDate(status.free_access_until) })}</Text>
            ) : null}
          </>
        ) : null}
        {status?.status === 'EXPIRED' ? (
          <View className="mt-3 flex-row gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
            <TriangleAlert size={15} color="#be123c" />
            <Text className="flex-1 text-xs font-bold text-rose-800">{t('subscription.panel.expiredMessage')}</Text>
          </View>
        ) : null}
        {isEndingSoon(status) ? (
          <View className="mt-3 flex-row gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <TriangleAlert size={15} color="#b45309" />
            <Text className="flex-1 text-xs font-bold text-amber-800">{t('subscription.panel.expiringSoon', { date: formatPlanDate(status.coverage_end) })}</Text>
          </View>
        ) : null}
        {notice ? <View className="mt-3"><Notice tone={notice.tone} text={notice.text} /></View> : null}
      </Panel>

      <Panel title={t('subscription.panel.choosePlan')}>
        {status?.region_supported === false ? <Notice tone="info" text={t('subscription.panel.regionUnavailable')} /> : null}
        <Text className="text-xs font-semibold text-slate-600">
          {t('subscription.panel.activationNote')}
        </Text>
        {inForce ? <Text className="mt-2 text-xs font-bold text-slate-600">{t('subscription.panel.changeRestriction')}</Text> : null}

        {/* Coupon */}
        <View className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          <Text className="mb-1 text-xs font-bold text-slate-600">{t('subscription.coupon.label')}</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={couponInput}
              onChangeText={(value) => setCouponInput(value.toUpperCase())}
              placeholder={t('subscription.coupon.placeholder')}
              placeholderTextColor={COLORS.slate[400]}
              autoCapitalize="characters"
              editable={!couponQuote}
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-graphite"
            />
            {couponQuote ? (
              <ActionButton small tone="outline" label={t('subscription.coupon.remove')} onPress={() => { setCouponQuote(null); setCouponInput(''); setCouponError('') }} />
            ) : (
              <ActionButton small label={couponBusy ? t('subscription.coupon.checking') : t('subscription.coupon.apply')} busy={couponBusy} disabled={!couponInput.trim()} onPress={applyCoupon} />
            )}
          </View>
          {couponQuote && quoteOffers.length > 0 ? (
            <Text className="mt-2 text-xs font-bold text-emerald-700">{t('subscription.coupon.applied', { code: couponQuote.code, plan: quoteOffers.map((offer) => t(`subscription.offer.${offer.id}.name`)).join(', ') })}</Text>
          ) : null}
          {couponError ? <Text className="mt-2 text-xs font-bold text-rose-600">{couponError}</Text> : null}
        </View>

        {/* Free tier */}
        <View className="mt-4 rounded-2xl border border-slate-200 p-4">
          <Text className="text-[15px] font-extrabold text-graphite">{t('subscription.plan.FREE')}</Text>
          {FREE_FEATURE_KEYS.map((key) => <Text key={key} className="mt-1 text-xs font-semibold text-slate-600">• {t(key)}</Text>)}
        </View>

        {/* Paid offers */}
        {OFFERS.map((offer) => {
          const price = offerPrice(catalogue, offer)
          const action = planAction(offer.planCode, status, price)
          const key = `${offer.planCode}:${offer.durationCode}`
          const disabled = action === 'unavailable' || action === 'blocked' || Boolean(busyPlan)
          const name = t(`subscription.offer.${offer.id}.name`)
          const label = busyPlan === key ? t('subscription.panel.processing')
            : action === 'renew' ? t('subscription.cta.renewOption', { duration: durationName(offer.durationCode, t) })
              : action === 'blocked' ? t('subscription.cta.afterCurrent')
                : action === 'unavailable' ? t('subscription.cta.unavailable')
                  : t('subscription.cta.chooseNamed', { plan: name })
          const coupon = quoteForOffer(couponQuote, offer.planCode, offer.durationCode)
          const premium = offer.id === 'PREMIUM_ANNUAL'
          return (
            <View key={offer.id} className={`mt-4 rounded-2xl border p-4 ${premium ? 'border-slate-800 bg-slate-900' : 'border-emerald-200 bg-white'}`}>
              <View className="flex-row items-center gap-2">
                <CreditCard size={16} color={premium ? '#fcd34d' : COLORS.brand[700]} />
                <Text className={`flex-1 text-[15px] font-extrabold ${premium ? 'text-white' : 'text-graphite'}`}>{name}</Text>
                <Text className={`text-[15px] font-extrabold ${premium ? 'text-amber-300' : 'text-brand-800'}`}>{price === null ? t('subscription.price.notSet') : formatRupees(price)}</Text>
              </View>
              <Text className={`mt-1 text-xs font-semibold ${premium ? 'text-slate-300' : 'text-slate-500'}`}>{t(`subscription.offer.${offer.id}.access`)}</Text>
              <Text className={`mt-0.5 text-xs ${premium ? 'text-slate-400' : 'text-slate-500'}`}>{t(`subscription.offer.${offer.id}.audience`)}</Text>
              {premium && saving ? (
                <Text className="mt-1 text-xs font-bold text-amber-300">{t('subscription.offer.annualSaving', { amount: formatRupees(saving.saving), full: formatRupees(saving.full) })}</Text>
              ) : null}
              {premium ? <Text className="mt-2 text-xs font-bold text-slate-300">{t('subscription.offer.PREMIUM_ANNUAL.inherits')}</Text> : null}
              {offerFeatureLines(catalogue, offer, t).map((line) => (
                <Text key={line} className={`mt-1 text-xs font-semibold ${premium ? 'text-slate-200' : 'text-slate-700'}`}>• {line}</Text>
              ))}
              {coupon ? (
                <View className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <InfoRow label={t('subscription.coupon.original')} value={formatRupees(coupon.original_amount_paise)} />
                  <InfoRow label={`${t('subscription.coupon.discount')} (${coupon.code || couponQuote?.code || ''})`} value={`− ${formatRupees(coupon.discount_paise)}`} />
                  <InfoRow label={t('subscription.coupon.final')} value={formatRupees(coupon.final_amount_paise)} strong />
                </View>
              ) : null}
              <ActionButton
                label={label}
                tone={premium ? 'outline' : 'success'}
                disabled={disabled}
                busy={busyPlan === key}
                onPress={() => purchase(offer.planCode, offer.durationCode)}
                className="mt-3"
              />
            </View>
          )
        })}
      </Panel>

      <Panel title={t('subscription.panel.history')}>
        {!status?.history?.length ? (
          <Text className="text-[13px] font-semibold text-slate-500">{t('subscription.panel.noHistory')}</Text>
        ) : status.history.map((row) => (
          <View key={row.id} className="border-b border-slate-100 py-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] font-extrabold text-graphite">{offerName(row.plan_code, row.duration_code, t)}</Text>
              <Text className="text-[13px] font-extrabold text-graphite">{formatRupees(row.amount_paise)}</Text>
            </View>
            <Text className="mt-0.5 text-xs text-slate-500">
              {durationName(row.duration_code, t)} · {formatPlanDate(row.period_start)} – {formatPlanDate(row.period_end)}
            </Text>
            <Text className="mt-0.5 text-xs font-bold text-slate-600">
              {paymentStatusName(row.status === 'REVOKED' ? 'REFUNDED' : row.payment_status, t)}
            </Text>
          </View>
        ))}
      </Panel>

      <Section>
        <Text className="text-center text-[11px] font-semibold text-slate-400">{t('mobile.billing.serverDecides')}</Text>
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
        <Text className="text-[13px] font-semibold text-slate-600">
          {t('payments.mockExplain')}
        </Text>
        <Text className="mt-3 text-xl font-extrabold text-graphite">{formatRupees(mockOrder?.amount_paise)}</Text>
        <View className="mt-4 gap-2">
          <ActionButton tone="success" label={t('payments.mockSuccess')} busy={simulating} disabled={simulating} onPress={() => simulate('success')} />
          <ActionButton tone="danger" label={t('payments.mockFailure')} disabled={simulating} onPress={() => simulate('failure')} />
          <ActionButton tone="outline" label={t('payments.mockCancel')} disabled={simulating} onPress={() => simulate('cancel')} />
        </View>
      </SheetModal>
    </StackScreenShell>
  )
}