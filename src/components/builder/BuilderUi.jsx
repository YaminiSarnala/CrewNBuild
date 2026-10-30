// Small building blocks shared by the Builder (CONTRACTOR) screens: tabs,
// badges, a bottom sheet, inputs, notices and the subscription banners. Same
// NativeWind look as the existing dashboard Panel / PanelState.
// Built-in text uses the web's translation keys (subscription.*, dash.common.*).
import { View, Text, Pressable, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from 'react-native'
import { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, Lock, Clock, Search, CalendarClock, ShieldCheck, ArrowLeft, ChevronDown, Check } from 'lucide-react-native'
import { useResponsive } from '../../hooks/useResponsive'
import { ContentWrap } from '../Responsive'
import { COLORS, SHADOW } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { useLanguage } from '../../i18n/LanguageContext'
import {
  dashboardBanner, formatPlanDate, isPremium, lockedMessage, offerName, statusName, currentTier,
} from '../../utils/subscriptionFormat'

/**
 * Chrome for a Builder screen pushed on the root stack (Plan & billing,
 * Portfolio, Profile Settings): a back arrow, a title and a scrolling body
 * with pull-to-refresh. Tabs use DashboardShell instead.
 */
export function StackScreenShell({ title, subtitle, onBack, refreshing, onRefresh, right, children }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  return (
    <View className="flex-1 bg-surface-deep">
      <View style={{ paddingTop: insets.top }} className="bg-brand-800 pb-4">
        <ContentWrap>
          <View className="flex-row items-center gap-3 px-4 pt-3">
            <Pressable onPress={onBack} accessibilityLabel={t('dash.common.back')} className="h-10 w-10 items-center justify-center rounded-full bg-glass/10">              <ArrowLeft size={20} color="#ffffff" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-[17px] font-extrabold text-white" numberOfLines={1}>{title}</Text>
              {subtitle ? <Text className="text-xs font-semibold text-brand-300" numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        </ContentWrap>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 28 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#134127" colors={['#134127']} />
          ) : undefined}
        >
          <ContentWrap>{children}</ContentWrap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

/** Horizontal gutter wrapper for content that is not inside a Panel. */
export function Section({ children, className = '', style }) {
  const { gutter } = useResponsive()
  return (
    <View className={`mb-4 ${className}`} style={[{ marginHorizontal: gutter }, style]}>
      {children}
    </View>
  )
}

/** Scrollable chip tabs. tabs: [{ id, label, count?, icon? }] */
export function SegmentTabs({ tabs, active, onChange, dense = false }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {tabs.map(({ id, label, count, icon: Icon }) => {
        const on = active === id
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className={`flex-row items-center gap-1.5 rounded-xl ${dense ? 'px-3 py-2' : 'px-3.5 py-2.5'} ${on ? 'bg-brand-700' : 'border border-slate-200 bg-white'}`}
          >
            {Icon ? <Icon size={13} color={on ? '#fff' : COLORS.slate[500]} /> : null}
            <Text className={`text-xs font-extrabold ${on ? 'text-white' : 'text-slate-600'}`}>
              {label}{count !== undefined && count !== null ? ` (${count})` : ''}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
export function Badge({ label, bg = '#f0f6f2', fg = '#134127' }) {
  // Fixed light colours; soft()/ink() give their dark-theme versions.
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: soft(bg, fg) }}>
      <Text className="text-[10px] font-extrabold uppercase" style={{ color: ink(fg), letterSpacing: 0.4 }}>{label}</Text>
    </View>
  )
}

// Labels are the web's STATUS_LABELS keys (pages/contractor/contractorRequestViews.jsx).
const REQUEST_STATUS = {
  pending: { labelKey: 'dash.contractor.status.newRequest', bg: '#f0f6f2', fg: '#1a5038' },
  accepted: { labelKey: 'ui.status.accepted', bg: '#ecfdf5', fg: '#047857' },
  sent: { labelKey: 'dash.contractor.status.proposalSent', bg: '#f0f9ff', fg: '#0369a1' },
  rejected: { labelKey: 'dash.contractor.status.declined', bg: '#fff1f2', fg: '#e11d48' },
  withdrawn: { labelKey: 'ui.shared.statusWithdrawn', bg: '#f1f5f9', fg: '#475569' },
}

/** Badge for a request board category (web RequestStatusBadge). */
export function RequestStatusBadge({ category, sentLabel }) {
  const { t } = useLanguage()
  const tone = REQUEST_STATUS[category] || REQUEST_STATUS.pending
  return <Badge label={category === 'sent' && sentLabel ? sentLabel : t(tone.labelKey)} bg={tone.bg} fg={tone.fg} />
}

export function ActionButton({ label, onPress, tone = 'primary', disabled, busy, icon: Icon, className = '', small = false }) {
  const styles = {
    primary: { box: 'bg-brand-700', text: 'text-white', icon: '#fff' },
    dark: { box: 'bg-slate-800', text: 'text-white', icon: '#fff' },
    outline: { box: 'border border-slate-300 bg-white', text: 'text-slate-700', icon: COLORS.slate[600] },
    brandOutline: { box: 'border border-brand-700 bg-white', text: 'text-brand-800', icon: COLORS.brand[700] },
    danger: { box: 'border border-rose-200 bg-rose-50', text: 'text-rose-700', icon: ink('#be123c') },    success: { box: 'bg-emerald-600', text: 'text-white', icon: '#fff' },
  }[tone] || {}
  const off = disabled || busy
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      className={`flex-row items-center justify-center gap-1.5 rounded-xl ${small ? 'h-9 px-3' : 'h-11 px-4'} ${styles.box} ${off ? 'opacity-50' : ''} ${className}`}
    >
      {busy ? <ActivityIndicator size="small" color={styles.icon} /> : Icon ? <Icon size={small ? 13 : 15} color={styles.icon} /> : null}
      <Text className={`${small ? 'text-[11px]' : 'text-[13px]'} font-extrabold ${styles.text}`} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

export function LabeledInput({ label, hint, multiline, style, ...props }) {
  return (
    <View className="mb-3">
      {label ? <Text className="mb-1 text-xs font-bold text-slate-600">{label}</Text> : null}
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={COLORS.slate[400]}
        className={`rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite ${multiline ? 'min-h-20 py-3' : 'h-11'}`}
        style={style}
      />
      {hint ? <Text className="mt-1 text-[11px] font-semibold text-slate-400">{hint}</Text> : null}
    </View>
  )
}

export function SearchBox({ value, onChangeText, placeholder }) {
  const { t } = useLanguage()
  return (
    <View className="h-11 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
      <Search size={15} color={COLORS.slate[400]} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('mobile.billing.ui.search')}
        placeholderTextColor={COLORS.slate[400]}
        autoCorrect={false}
        className="h-11 flex-1 text-[14px] font-semibold text-graphite"
      />
    </View>
  )
}

export function InfoRow({ label, value, strong = false }) {
  const { t } = useLanguage()
  return (
    <View className="flex-row items-start justify-between gap-3 border-b border-slate-100 py-2">
      <Text className="text-xs font-semibold text-slate-400">{label}</Text>
      <Text className={`flex-1 text-right text-xs ${strong ? 'font-extrabold text-graphite' : 'font-bold text-slate-700'}`}>
        {value === null || value === undefined || value === '' ? t('dash.common.notSet') : String(value)}
      </Text>
    </View>
  )
}

const NOTICE_TONES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-brand-100 bg-brand-50 text-brand-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
}

export function Notice({ tone = 'info', text }) {
  if (!text) return null
  const classes = NOTICE_TONES[tone] || NOTICE_TONES.info
  const [box, bg, color] = classes.split(' ')
  return (
    <View className={`mb-3 rounded-xl border px-3 py-2.5 ${box} ${bg}`}>
      <Text className={`text-xs font-bold ${color}`}>{text}</Text>
    </View>
  )
}

/** A bottom sheet over the screen: title row, scrolling body, optional footer. */
export function SheetModal({ visible, title, subtitle, onClose, children, footer, tall = false }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityLabel={t('dash.common.close')} />
        <View
          className="rounded-t-3xl bg-white"
          style={[{ maxHeight: tall ? '92%' : '85%', paddingBottom: Math.max(insets.bottom, 12) }, SHADOW.card]}
        >
          <View className="flex-row items-start gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
            <View className="flex-1">
              <Text className="text-[16px] font-extrabold text-graphite" numberOfLines={2}>{title}</Text>
              {subtitle ? <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={2}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel={t('dash.common.close')} className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <X size={16} color={COLORS.slate[600]} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="border-t border-slate-100 px-5 pt-3">{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/**
 * A web <select> on the phone: a chip showing the chosen option (or the
 * placeholder) that opens a sheet with the options. `options`: [{ value, label }];
 * the empty value '' is the "all" choice and shows `placeholder`.
 */
export function SelectChip({ placeholder, value = '', options, onChange, icon: Icon }) {
  const [open, setOpen] = useState(false)
  const chosen = options.find((option) => option.value === value)
  const active = value !== '' && value !== null && value !== undefined
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={`h-10 flex-row items-center gap-1.5 rounded-xl border px-3 ${active ? 'border-brand-700 bg-brand-50' : 'border-slate-200 bg-white'}`}
      >
        {Icon ? <Icon size={13} color={active ? COLORS.brand[800] : COLORS.slate[500]} /> : null}
        <Text className={`text-[12px] font-extrabold ${active ? 'text-brand-800' : 'text-graphite'}`} numberOfLines={1}>{chosen && active ? chosen.label : placeholder}</Text>
        <ChevronDown size={14} color={COLORS.slate[500]} />
      </Pressable>
      <SheetModal visible={open} title={placeholder} onClose={() => setOpen(false)}>
        {[{ value: '', label: placeholder }, ...options].map((option) => {
          const on = option.value === value || (option.value === '' && !active)
          return (
            <Pressable
              key={`${option.value}`}
              onPress={() => { onChange(option.value); setOpen(false) }}
              className="flex-row items-center justify-between border-b border-slate-100 py-3"
            >
              <Text className={`text-[14px] ${on ? 'font-extrabold text-brand-800' : 'font-semibold text-graphite'}`}>{option.label}</Text>
              {on ? <Check size={16} color={COLORS.brand[700]} /> : null}
            </Pressable>
          )
        })}
      </SheetModal>
    </>
  )
}

/** Two-way view switch (web Cards / Table, Grid / List). `options`: [{ id, label, icon }]. */
export function ViewToggle({ options, active, onChange }) {
  return (
    <View className="h-10 flex-row items-center rounded-xl border border-slate-200 bg-white p-1">
      {options.map(({ id, label, icon: Icon }) => {
        const on = active === id
        return (
          <Pressable key={id} onPress={() => onChange(id)} className={`h-8 flex-row items-center gap-1 rounded-lg px-2.5 ${on ? 'bg-brand-800' : ''}`}>
            {Icon ? <Icon size={13} color={on ? '#fff' : COLORS.slate[500]} /> : null}
            <Text className={`text-[12px] font-extrabold ${on ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** A simple confirmation dialog (web's centred decision box). */
export function ConfirmDialog({ visible, title, body, rows = [], confirmLabel, tone = 'primary', busy, onConfirm, onCancel }) {
  const { t } = useLanguage()
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full rounded-3xl bg-white p-5">
          <Text className="text-[16px] font-extrabold text-graphite">{title}</Text>
          {rows.length ? (
            <View className="mt-2">
              {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} strong />)}
            </View>
          ) : null}
          {body ? <Text className="mt-3 text-[13px] font-semibold leading-5 text-slate-600">{body}</Text> : null}
          <View className="mt-4 flex-row gap-2">
            <ActionButton label={t('dash.contractor.goBack')} tone="outline" onPress={onCancel} disabled={busy} className="flex-1" />
            <ActionButton label={confirmLabel} tone={tone} onPress={onConfirm} busy={busy} className="flex-1" />
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Subscription pieces (web subscription/*.jsx)
// ---------------------------------------------------------------------------

/** Shown in place of a premium feature the server refused. */
export function LockedFeature({ reason, onViewPlans, compact = false }) {
  const { t } = useLanguage()
  return (
    <View className={`rounded-2xl border border-emerald-200 bg-emerald-50 ${compact ? 'p-3' : 'p-4'}`}>
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-600">
          <Lock size={15} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-extrabold text-emerald-900">{t('subscription.locked.title')}</Text>
          <Text className="mt-1 text-[13px] font-semibold text-emerald-800">{lockedMessage(reason, t)}</Text>
          {onViewPlans ? (
            <ActionButton
              label={reason?.kind === 'expired' ? t('subscription.cta.renew') : t('subscription.locked.cta')}
              tone="success"
              small
              onPress={onViewPlans}
              className="mt-3 self-start"
            />
          ) : null}
        </View>
      </View>
    </View>
  )
}

/** Free-month days left, or the upgrade / renew prompt (web FreeAccessBanner). */
export function FreeAccessBanner({ status, onViewPlans }) {
  const { t } = useLanguage()
  const banner = dashboardBanner(status)
  if (!banner) return null
  if (banner.kind === 'trial') {
    return (
      <Section>
        <View className="flex-row items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
         <Clock size={16} color={ink('#0369a1')} />
          <Text className="flex-1 text-[13px] font-bold text-sky-900">
            {t('subscription.freeAccess.daysLeft', { days: banner.days, date: formatPlanDate(status.free_access_until) })}
          </Text>
          <ActionButton label={t('subscription.banner.upgradeCta')} tone="outline" small onPress={onViewPlans} />
        </View>
      </Section>
    )
  }
  const planExpired = banner.kind === 'planExpired'
  return (
    <Section>
      <View className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
        <View className="flex-row items-start gap-3">
<Lock size={16} color={ink('#b45309')} />
          <View className="flex-1">
            <Text className="text-[13px] font-extrabold text-amber-900">
              {t(planExpired ? 'subscription.planExpired.title' : 'subscription.freeAccess.expiredTitle')}
            </Text>
            <Text className="mt-0.5 text-xs font-semibold text-amber-900">
              {t(planExpired ? 'subscription.planExpired.body' : 'subscription.locked.freeExpired')}
            </Text>
          </View>
        </View>
        <ActionButton label={t(planExpired ? 'subscription.banner.renewCta' : 'subscription.banner.upgradeCta')} tone="success" small onPress={onViewPlans} className="mt-3 self-start" />
      </View>
    </Section>
  )
}

/** PRO / PREMIUM mark, only for a plan the server says is in force. */
export function PremiumBadge({ status }) {
  const { t } = useLanguage()
  if (!isPremium(status) || !status.badge) return null
  const premium = status.badge === 'PREMIUM'
  return (
    <View
      accessibilityLabel={t(`subscription.badge.${premium ? 'PREMIUM' : 'PRO'}.title`)}
      className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${premium ? 'bg-slate-900' : 'bg-emerald-600'}`}
    >
      <ShieldCheck size={12} color={premium ? '#fcd34d' : '#fff'} />
      <Text className={`text-[10px] font-extrabold ${premium ? 'text-amber-300' : 'text-white'}`}>{t(premium ? 'subscription.badge.PREMIUM' : 'subscription.badge.PRO')}</Text>
    </View>
  )
}

/** The plan at a glance on the dashboard (web PlanSummaryCard). */
export function PlanSummaryCard({ subscription, onOpen }) {
  const { t } = useLanguage()
  const { status, loading, error, unavailable, refresh } = subscription || {}
  // This server offers no plans: show nothing.
  if (unavailable) return null
  if (!status) {
    if (loading) {
      return (
        <Section>
          <View accessibilityLabel={t('subscription.panel.loading')} className="h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100">
            <ActivityIndicator color={COLORS.brand[800]} />
          </View>
        </Section>
      )
    }
    if (error) {
      return (
        <Section>
          <View className="flex-row items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5">
            <Text className="flex-1 text-[13px] font-bold text-rose-800">{t('subscription.panel.loadFailed')}</Text>
            <ActionButton label={t('subscription.retry')} tone="outline" small onPress={refresh} />
          </View>
        </Section>
      )
    }
    return null
  }
  if (status.region_supported === false) return null
  const paid = currentTier(status) !== 'FREE'
  const planName = paid ? offerName(status.plan_code, status.current_period?.duration_code, t) : t('subscription.plan.FREE')
  return (
    <Section>
      <View className="rounded-2xl border border-slate-200 bg-white px-4 py-3" style={SHADOW.card}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{t('subscription.summary.title')}</Text>
            <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
              <Text className="text-[15px] font-extrabold text-graphite">{planName}</Text>
              <PremiumBadge status={status} />
            </View>
            <View className="mt-1 flex-row items-center gap-1">
              <CalendarClock size={12} color={COLORS.slate[400]} />
              <Text className="text-xs font-semibold text-slate-600">
                {paid ? t('subscription.panel.validUntil', { date: formatPlanDate(status.coverage_end) }) : statusName(status.status, t)}
              </Text>
            </View>
            {status.status === 'GRACE' ? (
              <Text className="mt-0.5 text-xs font-bold text-amber-600">{t('subscription.panel.graceUntil', { date: formatPlanDate(status.grace_until) })}</Text>
            ) : null}
            {(status.queued_periods || []).map((period) => (
              <Text key={period.id} className="mt-0.5 text-xs text-slate-500">{t('subscription.panel.renewalQueued', { date: formatPlanDate(period.period_start) })}</Text>
            ))}
          </View>
          <ActionButton label={paid ? t('subscription.summary.managePlan') : t('subscription.summary.comparePlans')} tone={paid ? 'outline' : 'brandOutline'} small onPress={onOpen} />
        </View>
      </View>
    </Section>
  )
}
