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
import { createStyles } from '../../theme/createStyles'

/**
 * Chrome for a Builder screen pushed on the root stack (Plan & billing,
 * Portfolio, Profile Settings): a back arrow, a title and a scrolling body
 * with pull-to-refresh. Tabs use DashboardShell instead.
 */
export function StackScreenShell({ title, subtitle, onBack, refreshing, onRefresh, right, children }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  return (
    <View style={styles.view}>
      <View style={[styles.view2, { paddingTop: insets.top }]}>
        <ContentWrap>
          <View style={styles.view3}>
            <Pressable onPress={onBack} accessibilityLabel={t('dash.common.back')} style={styles.pressable}>              <ArrowLeft size={20} color="#ffffff" />
            </Pressable>
            <View style={styles.view4}>
              <Text style={styles.text} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={styles.text2} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        </ContentWrap>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.view4}>
        <ScrollView
          style={styles.view4}
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
export function Section({ children, style }) {
  const { gutter } = useResponsive()
  return (
    <View style={[styles.view5, [{ marginHorizontal: gutter }, style]]}>
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
            style={[styles.pressable2, dense ? styles.pressable3 : styles.pressable4, on ? styles.pressable5 : styles.pressable6]}
          >
            {Icon ? <Icon size={13} color={on ? '#fff' : COLORS.slate[500]} /> : null}
            <Text style={[styles.text3, on ? styles.text4 : styles.text5]}>
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
    <View style={[styles.view6, { backgroundColor: soft(bg, fg) }]}>
      <Text style={[styles.text6, { color: ink(fg), letterSpacing: 0.4 }]}>{label}</Text>
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

export function ActionButton({ label, onPress, tone = 'primary', disabled, busy, icon: Icon, style, small = false }) {
  const look = {
    primary: { box: 'pressable5', text: 'text4', icon: '#fff' },
    dark: { box: 'tone', text: 'text4', icon: '#fff' },
    outline: { box: 'tone2', text: 'tone3', icon: COLORS.slate[600] },
    brandOutline: { box: 'tone4', text: 'text7', icon: COLORS.brand[700] },
    danger: { box: 'tone5', text: 'tone6', icon: ink('#be123c') },    success: { box: 'view7', text: 'text4', icon: '#fff' },
  }[tone] || {}
  const off = disabled || busy
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={[styles.pressable7, small ? styles.pressable8 : styles.pressable9, styles[look.box], off ? styles.pressable10 : null, style]}
    >
      {busy ? <ActivityIndicator size="small" color={look.icon} /> : Icon ? <Icon size={small ? 13 : 15} color={look.icon} /> : null}
      <Text style={[small ? styles.text8 : styles.text9, styles.text10, styles[look.text]]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

export function LabeledInput({ label, hint, multiline, style, ...props }) {
  return (
    <View style={styles.view8}>
      {label ? <Text style={styles.text11}>{label}</Text> : null}
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={COLORS.slate[400]}
        style={[styles.textInput, multiline ? styles.textInput2 : styles.textInput3, style]}
      />
      {hint ? <Text style={styles.text12}>{hint}</Text> : null}
    </View>
  )
}

export function SearchBox({ value, onChangeText, placeholder }) {
  const { t } = useLanguage()
  return (
    <View style={styles.view9}>
      <Search size={15} color={COLORS.slate[400]} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('mobile.billing.ui.search')}
        placeholderTextColor={COLORS.slate[400]}
        autoCorrect={false}
        style={styles.textInput4}
      />
    </View>
  )
}

export function InfoRow({ label, value, strong = false }) {
  const { t } = useLanguage()
  return (
    <View style={styles.view10}>
      <Text style={styles.text13}>{label}</Text>
      <Text style={[styles.text14, strong ? styles.text15 : styles.text16]}>
        {value === null || value === undefined || value === '' ? t('dash.common.notSet') : String(value)}
      </Text>
    </View>
  )
}

const NOTICE_TONES = {
  success: 'tone7',
  error: 'tone8',
  info: 'tone9',
  warn: 'tone10',
}

export function Notice({ tone = 'info', text }) {
  if (!text) return null
  const classes = NOTICE_TONES[tone] || NOTICE_TONES.info
  const [box, bg, color] = classes.split(' ')
  return (
    <View style={[styles.view11, styles[box], styles[bg]]}>
      <Text style={[styles.text17, styles[color]]}>{text}</Text>
    </View>
  )
}

/** A bottom sheet over the screen: title row, scrolling body, optional footer. */
export function SheetModal({ visible, title, subtitle, onClose, children, footer, tall = false }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.view4}>
        <Pressable style={styles.pressable11} onPress={onClose} accessibilityLabel={t('dash.common.close')} />
        <View
          style={[styles.view12, [{ maxHeight: tall ? '92%' : '85%', paddingBottom: Math.max(insets.bottom, 12) }, SHADOW.card]]}
        >
          <View style={styles.view13}>
            <View style={styles.view4}>
              <Text style={styles.text18} numberOfLines={2}>{title}</Text>
              {subtitle ? <Text style={styles.text19} numberOfLines={2}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel={t('dash.common.close')} style={styles.pressable12}>
              <X size={16} color={COLORS.slate[600]} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.view14}>{footer}</View> : null}
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
        style={[styles.pressable13, active ? styles.pressable14 : styles.pressable15]}
      >
        {Icon ? <Icon size={13} color={active ? COLORS.brand[800] : COLORS.slate[500]} /> : null}
        <Text style={[styles.text20, active ? styles.text7 : styles.text21]} numberOfLines={1}>{chosen && active ? chosen.label : placeholder}</Text>
        <ChevronDown size={14} color={COLORS.slate[500]} />
      </Pressable>
      <SheetModal visible={open} title={placeholder} onClose={() => setOpen(false)}>
        {[{ value: '', label: placeholder }, ...options].map((option) => {
          const on = option.value === value || (option.value === '' && !active)
          return (
            <Pressable
              key={`${option.value}`}
              onPress={() => { onChange(option.value); setOpen(false) }}
              style={styles.pressable16}
            >
              <Text style={[styles.text22, on ? styles.text23 : styles.text24]}>{option.label}</Text>
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
    <View style={styles.view15}>
      {options.map(({ id, label, icon: Icon }) => {
        const on = active === id
        return (
          <Pressable key={id} onPress={() => onChange(id)} style={[styles.pressable17, on ? styles.pressable18 : null]}>
            {Icon ? <Icon size={13} color={on ? '#fff' : COLORS.slate[500]} /> : null}
            <Text style={[styles.text20, on ? styles.text4 : styles.text5]}>{label}</Text>
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
      <View style={styles.view16}>
        <View style={styles.view17}>
          <Text style={styles.text18}>{title}</Text>
          {rows.length ? (
            <View style={styles.view18}>
              {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} strong />)}
            </View>
          ) : null}
          {body ? <Text style={styles.text25}>{body}</Text> : null}
          <View style={styles.view19}>
            <ActionButton label={t('dash.contractor.goBack')} tone="outline" onPress={onCancel} disabled={busy} style={styles.view4} />
            <ActionButton label={confirmLabel} tone={tone} onPress={onConfirm} busy={busy} style={styles.view4} />
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
    <View style={[styles.view20, compact ? styles.view21 : styles.view22]}>
      <View style={styles.view23}>
        <View style={styles.view24}>
          <Lock size={15} color="#fff" />
        </View>
        <View style={styles.view4}>
          <Text style={styles.text26}>{t('subscription.locked.title')}</Text>
          <Text style={styles.text27}>{lockedMessage(reason, t)}</Text>
          {onViewPlans ? (
            <ActionButton
              label={reason?.kind === 'expired' ? t('subscription.cta.renew') : t('subscription.locked.cta')}
              tone="success"
              small
              onPress={onViewPlans}
              style={styles.actionButton}
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
        <View style={styles.view25}>
         <Clock size={16} color={ink('#0369a1')} />
          <Text style={styles.text28}>
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
      <View style={styles.view26}>
        <View style={styles.view23}>
<Lock size={16} color={ink('#b45309')} />
          <View style={styles.view4}>
            <Text style={styles.text29}>
              {t(planExpired ? 'subscription.planExpired.title' : 'subscription.freeAccess.expiredTitle')}
            </Text>
            <Text style={styles.text30}>
              {t(planExpired ? 'subscription.planExpired.body' : 'subscription.locked.freeExpired')}
            </Text>
          </View>
        </View>
        <ActionButton label={t(planExpired ? 'subscription.banner.renewCta' : 'subscription.banner.upgradeCta')} tone="success" small onPress={onViewPlans} style={styles.actionButton} />
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
      style={[styles.view27, premium ? styles.view28 : styles.view7]}
    >
      <ShieldCheck size={12} color={premium ? '#fcd34d' : '#fff'} />
      <Text style={[styles.text31, premium ? styles.text32 : styles.text4]}>{t(premium ? 'subscription.badge.PREMIUM' : 'subscription.badge.PRO')}</Text>
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
          <View accessibilityLabel={t('subscription.panel.loading')} style={styles.view29}>
            <ActivityIndicator color={COLORS.brand[800]} />
          </View>
        </Section>
      )
    }
    if (error) {
      return (
        <Section>
          <View style={styles.view30}>
            <Text style={styles.text33}>{t('subscription.panel.loadFailed')}</Text>
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
      <View style={[styles.view31, SHADOW.card]}>
        <View style={styles.view32}>
          <View style={styles.view4}>
            <Text style={styles.text34}>{t('subscription.summary.title')}</Text>
            <View style={styles.view33}>
              <Text style={styles.text35}>{planName}</Text>
              <PremiumBadge status={status} />
            </View>
            <View style={styles.view34}>
              <CalendarClock size={12} color={COLORS.slate[400]} />
              <Text style={styles.text36}>
                {paid ? t('subscription.panel.validUntil', { date: formatPlanDate(status.coverage_end) }) : statusName(status.status, t)}
              </Text>
            </View>
            {status.status === 'GRACE' ? (
              <Text style={styles.text37}>{t('subscription.panel.graceUntil', { date: formatPlanDate(status.grace_until) })}</Text>
            ) : null}
            {(status.queued_periods || []).map((period) => (
              <Text key={period.id} style={styles.text38}>{t('subscription.panel.renewalQueued', { date: formatPlanDate(period.period_start) })}</Text>
            ))}
          </View>
          <ActionButton label={paid ? t('subscription.summary.managePlan') : t('subscription.summary.comparePlans')} tone={paid ? 'outline' : 'brandOutline'} small onPress={onOpen} />
        </View>
      </View>
    </Section>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: c.canvas },
  view2: { backgroundColor: '#134127', paddingBottom: 14 },
  view3: { flexDirection: 'row', alignItems: 'center', gap: 10.5, paddingHorizontal: 14, paddingTop: 10.5 },
  pressable: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  view4: { flex: 1 },
  text: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  text2: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#9dc5af' },
  view5: { marginBottom: 14 },
  pressable2: { flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 12 },
  pressable3: { paddingHorizontal: 10.5, paddingVertical: 7 },
  pressable4: { paddingHorizontal: 12.25, paddingVertical: 8.75 },
  pressable5: { backgroundColor: '#1a5038' },
  pressable6: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  text3: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  text4: { color: '#ffffff' },
  text5: { color: c.textSecondary },
  view6: { alignSelf: 'flex-start', borderRadius: 9999, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text6: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  tone: { backgroundColor: '#1e293b' },
  tone2: { borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.card },
  tone3: { color: c.textSoft },
  tone4: { borderWidth: 1, borderColor: '#1a5038', backgroundColor: c.card },
  text7: { color: c.brandTextStrong },
  tone5: { borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  tone6: { color: c.roseText },
  view7: { backgroundColor: '#059669' },
  pressable7: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 12 },
  pressable8: { height: 31.5, paddingHorizontal: 10.5 },
  pressable9: { height: 38.5, paddingHorizontal: 14 },
  pressable10: { opacity: 0.5 },
  text8: { fontSize: 11 },
  text9: { fontSize: 13 },
  text10: { fontWeight: '800' },
  view8: { marginBottom: 10.5 },
  text11: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  textInput: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  textInput2: { minHeight: 70, paddingVertical: 10.5 },
  textInput3: { height: 38.5 },
  text12: { marginTop: 3.5, fontSize: 11, fontWeight: '600', color: c.textFaint },
  view9: { height: 38.5, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5 },
  textInput4: { height: 38.5, flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
  view10: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 7 },
  text13: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textFaint },
  text14: { flex: 1, textAlign: 'right', fontSize: 12, lineHeight: 16 },
  text15: { fontWeight: '800', color: c.text },
  text16: { fontWeight: '700', color: c.textSoft },
  tone7: { borderColor: c.emeraldBorder, backgroundColor: c.emeraldSoft, color: c.emeraldTextStrong },
  tone8: { borderColor: c.roseBorder, backgroundColor: c.roseSoft, color: c.roseTextStrong },
  tone9: { borderColor: c.brandBorder, backgroundColor: c.brandSoft, color: c.brandTextStrong },
  tone10: { borderColor: c.amberBorder, backgroundColor: c.amberSoft, color: c.amberTextStrong },
  view11: { marginBottom: 10.5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text17: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  pressable11: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  view12: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: c.card },
  view13: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 17.5, paddingBottom: 10.5, paddingTop: 14 },
  text18: { fontSize: 16, fontWeight: '800', color: c.text },
  text19: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  pressable12: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.muted },
  view14: { borderTopWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 17.5, paddingTop: 10.5 },
  pressable13: { height: 35, flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10.5 },
  pressable14: { borderColor: '#1a5038', backgroundColor: c.brandSoft },
  pressable15: { borderColor: c.border, backgroundColor: c.card },
  text20: { fontSize: 12, fontWeight: '800' },
  text21: { color: c.text },
  pressable16: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text22: { fontSize: 14 },
  text23: { fontWeight: '800', color: c.brandTextStrong },
  text24: { fontWeight: '600', color: c.text },
  view15: { height: 35, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 3.5 },
  pressable17: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 3.5, borderRadius: 8, paddingHorizontal: 8.75 },
  pressable18: { backgroundColor: '#134127' },
  view16: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 21 },
  view17: { width: '100%', borderRadius: 24, backgroundColor: c.card, padding: 17.5 },
  view18: { marginTop: 7 },
  text25: { marginTop: 10.5, fontSize: 13, fontWeight: '600', lineHeight: 17.5, color: c.textSecondary },
  view19: { marginTop: 14, flexDirection: 'row', gap: 7 },
  view20: { borderRadius: 16, borderWidth: 1, borderColor: c.emeraldBorder, backgroundColor: c.emeraldSoft },
  view21: { padding: 10.5 },
  view22: { padding: 14 },
  view23: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5 },
  view24: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#059669' },
  text26: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.emeraldTextStrong },
  text27: { marginTop: 3.5, fontSize: 13, fontWeight: '600', color: c.emeraldTextStrong },
  actionButton: { marginTop: 10.5, alignSelf: 'flex-start' },
  view25: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderRadius: 16, borderWidth: 1, borderColor: c.skyBorder, backgroundColor: c.skySoft, paddingHorizontal: 14, paddingVertical: 10.5 },
  text28: { flex: 1, fontSize: 13, fontWeight: '700', color: c.skyTextStrong },
  view26: { borderRadius: 16, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: c.amberSoft, paddingHorizontal: 14, paddingVertical: 10.5 },
  text29: { fontSize: 13, fontWeight: '800', color: c.amberTextStrong },
  text30: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.amberTextStrong },
  view27: { flexDirection: 'row', alignItems: 'center', gap: 3.5, alignSelf: 'flex-start', borderRadius: 9999, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  view28: { backgroundColor: '#0f172a' },
  text31: { fontSize: 10, fontWeight: '800' },
  text32: { color: '#fcd34d' },
  view29: { height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted },
  view30: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderRadius: 16, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 14, paddingVertical: 8.75 },
  text33: { flex: 1, fontSize: 13, fontWeight: '700', color: c.roseTextStrong },
  view31: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10.5 },
  view32: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  text34: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  view33: { marginTop: 1.75, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  text35: { fontSize: 15, fontWeight: '800', color: c.text },
  view34: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text36: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary },
  text37: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.amberTextSoft },
  text38: { marginTop: 1.75, fontSize: 12, lineHeight: 16, color: c.textMuted },
}))
