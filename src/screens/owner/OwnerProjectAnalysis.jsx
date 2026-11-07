// Port of web pages/owner/OwnerProjectAnalysisView.jsx — the Project Analysis
// tab of an owner's project: budget, recorded spending, work-item progress,
// material usage and schedule for this one project.
//
// Read-only. Everything comes from the project payload and the cost summary
// (GET /cost-tool/projects/{id}/summary), which the backend returns only to
// this project's owner. Nothing here estimates or fills in a value: a figure
// the records do not hold reads "Not set" / "Not available".
//
// Phone differences from the web: hover readouts are taps, and the web's wide
// tables are stacked rows. Figures and rules are the web's (ownerProjectAnalysis.js).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg'
import {
  AlertTriangle, BarChart3, CalendarCheck, CalendarDays, CheckCircle2, Clock3, Package,
  PiggyBank, Receipt, RotateCcw, TrendingUp, Wallet,
} from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useTheme } from '../../theme/ThemeContext'
import { fetchCostToolSummary } from '../../api/costTool'
import { formatPercent, scheduleText } from '../../utils/builderHelpers'
import { formatProjectDate, money } from './ownerHelpers'
import {
  analysisFigures, budgetRows, materialRows, recentExpenses, spendingTrend, workItemProgress,
} from './ownerProjectAnalysis'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

// One colour per spending category, in this order — the web's light steps and
// its re-stepped dark steps.
const CATEGORY_COLORS = {
  light: { material_cost: '#126b45', labour_cost: '#1683E8', machinery_cost: '#F58A00', expenses: '#9146D8' },
  dark: { material_cost: '#2fa26e', labour_cost: '#3b8fe6', machinery_cost: '#d97706', expenses: '#a160e0' },
}

// Compact money for chart axes (₹12L, ₹1.2Cr; KWD 12K), full money elsewhere.
function compactMoney(value, country) {
  const kuwait = String(country || '').trim().toLowerCase() === 'kuwait'
  const formatted = new Intl.NumberFormat(kuwait ? 'en' : 'en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  return kuwait ? `KWD ${formatted}` : `₹${formatted}`
}

const pct = (part, whole) => formatPercent(Math.round((part / whole) * 1000) / 10)

function Card({ icon: Icon, title, subtitle, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {Icon ? (
          <View style={styles.cardIcon}><Icon size={16} color={COLORS.brand[700]} /></View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={{ marginTop: 14 }}>{children}</View>
    </View>
  )
}

function EmptyNote({ children }) {
  return <Text style={styles.empty}>{children}</Text>
}

const NOTE_TONES = { neutral: '#64748b', good: '#047857', warn: '#b45309', bad: '#dc2626' }

function SummaryCard({ icon: Icon, label, value, note, tone = 'neutral' }) {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHead}>
        <View style={styles.summaryIcon}><Icon size={13} color={COLORS.brand[700]} /></View>
        <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, tone === 'bad' ? { color: '#dc2626' } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {note ? (
        <View style={styles.summaryNoteRow}>
          {tone === 'bad' || tone === 'warn' ? <AlertTriangle size={11} color={NOTE_TONES[tone]} /> : null}
          <Text style={[styles.summaryNote, { color: NOTE_TONES[tone] }]} numberOfLines={1}>{note}</Text>
        </View>
      ) : null}
    </View>
  )
}

// Chart A: where the recorded money went, by category. Tap a segment or row.
function SpendingDonut({ categories, spent, country, colors, isDark, t }) {
  const [active, setActive] = useState(null)
  const size = 168
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const gap = categories.length > 1 ? 2 : 0
  let offset = 0
  const segments = categories.map((category) => {
    const length = (category.value / spent) * circumference
    const segment = { ...category, dash: Math.max(0, length - gap), offset }
    offset += length
    return segment
  })
  const shown = segments.find((segment) => segment.key === active)
  const toggle = (key) => setActive((current) => (current === key ? null : key))
  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
            {segments.map((segment) => (
              <Circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={colors[segment.key]}
                strokeWidth={active === segment.key ? stroke + 4 : stroke}
                strokeDasharray={`${segment.dash} ${circumference}`}
                strokeDashoffset={-segment.offset}
                onPress={() => toggle(segment.key)}
              />
            ))}
          </G>
        </Svg>
        <View pointerEvents="none" style={styles.donutCenter}>
          <Text style={styles.donutLabel}>{shown ? t(shown.labelKey) : t('owner.pa.totalSpent')}</Text>
          <Text style={styles.donutValue}>{money(shown ? shown.value : spent, country)}</Text>
          {shown ? <Text style={styles.donutPct}>{pct(shown.value, spent)}</Text> : null}
        </View>
      </View>
      <View style={{ alignSelf: 'stretch', gap: 4 }}>
        {segments.map((segment) => (
          <Pressable
            key={segment.key}
            onPress={() => toggle(segment.key)}
            style={[styles.legendRow, active === segment.key ? styles.legendRowActive : null]}
          >
            <View style={[styles.dot, { backgroundColor: colors[segment.key] }]} />
            <Text style={styles.legendName} numberOfLines={1}>{t(segment.labelKey)}</Text>
            <Text style={styles.legendValue}>{money(segment.value, country)}</Text>
            <Text style={styles.legendPct}>{pct(segment.value, spent)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const ITEM_STATUS = {
  completed: { labelKey: 'owner.pa.statusCompleted', bar: 'material_cost', ink: '#047857', Icon: CheckCircle2 },
  ongoing: { labelKey: 'owner.pa.statusOngoing', bar: 'labour_cost', ink: null, Icon: Clock3 },
  notStarted: { labelKey: 'owner.pa.statusNotStarted', bar: null, ink: '#64748b', Icon: Clock3 },
}
const MAX_ITEMS = 8

// Chart B: progress per BOQ work item, as horizontal bars from one baseline.
function WorkItemBars({ items, colors, t }) {
  return (
    <View>
      <View style={{ gap: 12 }}>
        {items.slice(0, MAX_ITEMS).map((item) => {
          const status = ITEM_STATUS[item.status]
          const ink = status.ink || COLORS.graphite
          return (
            <View key={item.reference}>
              <View style={styles.barHead}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.label}
                  <Text style={styles.barRef}>{`  ${item.reference}`}</Text>
                </Text>
                <Text style={styles.barPct}>{formatPercent(item.percent)}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${item.percent}%`, backgroundColor: status.bar ? colors[status.bar] : 'transparent' }]} />
              </View>
              <View style={styles.barFoot}>
                <View style={styles.barStatus}>
                  <status.Icon size={11} color={ink} />
                  <Text style={[styles.barStatusText, { color: ink }]}>{t(status.labelKey)}</Text>
                </View>
                <Text style={styles.barQty}>
                  {`${item.completed.toLocaleString()} / ${item.planned.toLocaleString()}${item.unit ? ` ${item.unit}` : ''}`}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
      {items.length > MAX_ITEMS ? <Text style={styles.footNote}>{t('owner.pa.moreItems', { count: items.length - MAX_ITEMS })}</Text> : null}
    </View>
  )
}

// Chart C: cumulative recorded spending over work dates. Tap to read a day.
function SpendingTrend({ points, country, color, isDark, t }) {
  const [width, setWidth] = useState(0)
  const [hoverIndex, setHoverIndex] = useState(null)
  const height = 220
  const pad = { top: 16, right: 16, bottom: 30, left: 56 }
  const plotWidth = Math.max(0, width - pad.left - pad.right)
  const plotHeight = height - pad.top - pad.bottom
  const times = points.map((point) => Date.parse(`${point.date}T00:00:00`))
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const maxValue = Math.max(...points.map((point) => point.cumulative), 1)
  const x = (index) => (maxTime === minTime ? pad.left + plotWidth / 2 : pad.left + ((times[index] - minTime) / (maxTime - minTime)) * plotWidth)
  const y = (value) => pad.top + plotHeight - (value / maxValue) * plotHeight
  const ticks = [0, maxValue / 2, maxValue]
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.cumulative).toFixed(1)}`).join(' ')
  const area = points.length > 1 ? `${path} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : ''
  const dateTicks = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, index) => index)
  const last = points.length - 1
  const hovered = hoverIndex === null ? null : points[hoverIndex]
  const grid = isDark ? '#334155' : '#e2e8f0'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const pick = (event) => {
    const pointerX = event.nativeEvent.locationX
    let nearest = 0
    points.forEach((_, index) => { if (Math.abs(x(index) - pointerX) < Math.abs(x(nearest) - pointerX)) nearest = index })
    setHoverIndex((current) => (current === nearest ? null : nearest))
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {width > 0 ? (
        <Pressable onPress={pick} accessibilityLabel={t('owner.pa.spendTrend')}>
          <Svg width={width} height={height}>
            {ticks.map((tick) => (
              <G key={tick}>
                <Line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={grid} strokeWidth={1} />
                <SvgText x={pad.left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize={10} fontWeight="600" fill={muted}>{compactMoney(tick, country)}</SvgText>
              </G>
            ))}
            {dateTicks.map((index) => (
              <SvgText
                key={points[index].date}
                x={x(index)}
                y={height - 8}
                textAnchor={index === 0 && points.length > 1 ? 'start' : index === last && points.length > 1 ? 'end' : 'middle'}
                fontSize={10}
                fontWeight="600"
                fill={muted}
              >
                {formatProjectDate(points[index].date, t)}
              </SvgText>
            ))}
            {area ? <Path d={area} fill={color} opacity={0.1} /> : null}
            <Path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hovered ? <Line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={pad.top} y2={pad.top + plotHeight} stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth={1} /> : null}
            <Circle cx={x(hovered ? hoverIndex : last)} cy={y((hovered || points[last]).cumulative)} r={4.5} fill={color} stroke={isDark ? '#0f172a' : '#ffffff'} strokeWidth={2} />
            {!hovered ? (
              <SvgText x={x(last)} y={y(points[last].cumulative) - 10} textAnchor={points.length > 1 ? 'end' : 'middle'} fontSize={11} fontWeight="800" fill={isDark ? '#e2e8f0' : '#1f2937'}>
                {money(points[last].cumulative, country)}
              </SvgText>
            ) : null}
          </Svg>
          {hovered ? (
            <View
              pointerEvents="none"
              style={[styles.tooltip, x(hoverIndex) > width / 2 ? { left: Math.max(0, x(hoverIndex) - 180) } : { left: x(hoverIndex) + 10 }]}
            >
              <Text style={styles.tooltipTitle}>{formatProjectDate(hovered.date, t)}</Text>
              <View style={styles.tooltipRow}><Text style={styles.tooltipLabel}>{t('owner.pa.dailySpend')}</Text><Text style={styles.tooltipValue}>{money(hovered.daily, country)}</Text></View>
              <View style={styles.tooltipRow}><Text style={styles.tooltipLabel}>{t('owner.pa.cumulative')}</Text><Text style={styles.tooltipValue}>{money(hovered.cumulative, country)}</Text></View>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  )
}

// Pastel chips keep their dark ink in both themes, like the app's other badges.
const STOCK_STATUS = {
  IN_STOCK: { labelKey: 'owner.pa.stockIn', bg: '#ecfdf5', ink: '#047857' },
  LOW_STOCK: { labelKey: 'owner.pa.stockLow', bg: '#fffbeb', ink: '#92400e' },
  OUT_OF_STOCK: { labelKey: 'owner.pa.stockOut', bg: '#fef2f2', ink: '#b91c1c' },
}

/** A stacked "row" for the web's tables: a title line, then label/value pairs. */
function StackRow({ title, titleRight, dotColor, pairs, highlight }) {
  return (
    <View style={[styles.stackRow, highlight ? styles.stackRowTotal : null]}>
      <View style={styles.stackHead}>
        {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor, width: 8, height: 8 }]} /> : null}
        <Text style={styles.stackTitle} numberOfLines={2}>{title}</Text>
        {titleRight}
      </View>
      <View style={styles.stackPairs}>
        {pairs.map(([label, value, valueStyle]) => (
          <View key={label} style={styles.stackPair}>
            <Text style={styles.stackLabel}>{label}</Text>
            <Text style={[styles.stackValue, valueStyle]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function OwnerProjectAnalysis({ project, viewer = 'owner' }) {
  const { t } = useLanguage()
  const { isDark } = useTheme()
  const colors = CATEGORY_COLORS[isDark ? 'dark' : 'light']
  const country = project.project_country || 'India'
  const notAvailable = t('progress.notAvailable')
  const notSet = t('dash.common.notSet')
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fetchCostToolSummary(project.id)
      .then((data) => { if (alive) setState({ status: 'ready', data }) })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [project.id, attempt])
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const data = state.status === 'ready' ? state.data : null
  const figures = useMemo(() => analysisFigures(data?.dashboard), [data])
  const trend = useMemo(() => spendingTrend(data?.registers), [data])
  const workItems = useMemo(() => workItemProgress(data?.registers), [data])
  const budget = useMemo(() => budgetRows(project, data?.dashboard), [project, data])
  const materials = useMemo(() => materialRows(data?.materials), [data])
  const expenses = useMemo(() => recentExpenses(data?.expenses), [data])

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.brand[700]} />
        <Text style={styles.centerText}>{t('owner.analysis.loading')}</Text>
      </View>
    )
  }
  if (state.status === 'error' || !figures) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>{t('owner.analysis.error')}</Text>
        <Pressable onPress={retry} style={styles.retry}>
          <RotateCcw size={14} color={COLORS.graphite} />
          <Text style={styles.retryText}>{t('owner.analysis.retry')}</Text>
        </Pressable>
      </View>
    )
  }

  const completion = data.dashboard?.project_completion
  const lowStock = materials.filter((item) => item.status !== 'IN_STOCK').length
  const trendTotal = trend.length ? trend[trend.length - 1].cumulative : 0
  const trendPartial = trend.length > 0 && Math.abs(trendTotal - figures.spent) > 1
  const itemCounts = workItems.reduce((counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }), { completed: 0, ongoing: 0, notStarted: 0 })
  const schedule = scheduleText(project, t)
  const daysLeft = project.schedule_status === 'in_progress'
    ? t('owner.pa.daysLeftValue', { days: Math.max(0, Number(project.schedule_total_days) - Number(project.schedule_elapsed_days)) })
    : project.schedule_status === 'end_date_passed'
      ? t('owner.pa.endPassed')
      : project.schedule_status === 'not_started'
        ? t('owner.pa.notStartedYet')
        : notAvailable
  // The full analysis (materials, budget breakdown, expenses) is for whoever
  // runs the site: the builder, or the owner on a self-construction project.
  const detailed = viewer === 'builder' || project.construction_type === 'SELF_CONSTRUCTION'

  return (
    <View style={{ gap: 14 }}>
      {/* Summary */}
      <View style={styles.summaryGrid}>
        <SummaryCard
          icon={Wallet}
          label={t('owner.pa.totalBudget')}
          value={figures.budget === null ? notSet : money(figures.budget, country)}
          note={project.contract_amount != null ? t('owner.pa.contractValue') : t(viewer === 'builder' ? 'owner.pa.ownerBudget' : 'owner.pa.yourBudget')}
        />
        <SummaryCard
          icon={Receipt}
          label={t('owner.pa.amountSpent')}
          value={money(figures.spent, country)}
          note={figures.utilization === null ? null : t('owner.pa.ofBudget', { percent: formatPercent(figures.utilization) })}
        />
        <SummaryCard
          icon={PiggyBank}
          label={t('owner.pa.remainingBudget')}
          value={figures.remaining === null ? notAvailable : figures.overrun ? `-${money(figures.overrun, country)}` : money(figures.remaining, country)}
          note={figures.remaining === null ? null : figures.overrun ? t('owner.pa.overBudget') : t('owner.pa.leftToSpend')}
          tone={figures.overrun ? 'bad' : 'neutral'}
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('owner.pa.overallProgress')}
          value={completion == null ? notAvailable : formatPercent(completion)}
          note={completion == null ? t('owner.pa.completionUnavailable') : null}
        />
        {detailed ? (
          <SummaryCard
            icon={Package}
            label={t('owner.pa.materials')}
            value={materials.length ? t('owner.pa.materialsTracked', { count: materials.length }) : t('owner.pa.noneRecorded')}
            note={!materials.length ? null : lowStock ? t('owner.pa.lowStock', { count: lowStock }) : t('owner.pa.allInStock')}
            tone={lowStock ? 'warn' : materials.length ? 'good' : 'neutral'}
          />
        ) : null}
      </View>

      <Card icon={Wallet} title={t('owner.pa.spendByCategory')} subtitle={t('owner.pa.spendByCategorySub')}>
        {figures.categories.length
          ? <SpendingDonut categories={figures.categories} spent={figures.spent} country={country} colors={colors} isDark={isDark} t={t} />
          : <EmptyNote>{t('owner.analysis.noSpend')}</EmptyNote>}
      </Card>

      <Card icon={TrendingUp} title={t('owner.pa.spendTrend')} subtitle={t('owner.pa.spendTrendSub')}>
        {trend.length ? (
          <>
            <SpendingTrend points={trend} country={country} color={colors.labour_cost} isDark={isDark} t={t} />
            {trendPartial ? <Text style={styles.footNote}>{t('owner.pa.trendPartial')}</Text> : null}
          </>
        ) : <EmptyNote>{t('owner.pa.noTrend')}</EmptyNote>}
      </Card>

      <Card icon={BarChart3} title={t('owner.pa.phaseProgress')} subtitle={t('owner.pa.phaseProgressSub')}>
        {workItems.length ? <WorkItemBars items={workItems} colors={colors} t={t} /> : <EmptyNote>{t('owner.pa.noPhaseProgress')}</EmptyNote>}
      </Card>

      {detailed ? (
        <>
          <Card icon={Package} title={t('owner.pa.materialUsage')} subtitle={t('owner.pa.materialUsageSub')}>
            {materials.length ? materials.map((item) => {
              const status = STOCK_STATUS[item.status] || STOCK_STATUS.IN_STOCK
              const unit = item.unit ? ` ${item.unit}` : ''
              return (
                <StackRow
                  key={item.key}
                  title={item.material}
                  titleRight={(
                    <View style={[styles.chip, { backgroundColor: status.bg }]}>
                      <Text style={[styles.chipText, { color: status.ink }]}>{t(status.labelKey)}</Text>
                    </View>
                  )}
                  pairs={[
                    [t('owner.pa.colReceived'), `${item.received.toLocaleString()}${unit}`],
                    [t('owner.pa.colUsed'), `${item.used.toLocaleString()}${unit}`],
                    [t('owner.pa.colInStock'), `${item.remaining.toLocaleString()}${unit}`, styles.bold],
                    [t('owner.pa.colUsedPct'), item.percentUsed === null ? '—' : formatPercent(item.percentUsed)],
                  ]}
                />
              )
            }) : <EmptyNote>{t('owner.pa.noMaterials')}</EmptyNote>}
          </Card>

          <Card icon={PiggyBank} title={t('owner.pa.budgetBreakdown')} subtitle={t('owner.pa.budgetBreakdownSub')}>
            {budget.map((row) => (
              <StackRow
                key={row.key}
                title={t(row.labelKey)}
                dotColor={colors[row.key]}
                pairs={[
                  [t('owner.pa.colPlanned'), row.planned === null ? notSet : money(row.planned, country), row.planned === null ? styles.faint : null],
                  [t('owner.pa.colActual'), money(row.actual, country), styles.bold],
                  [t('owner.pa.colRemaining'), row.remaining === null ? '—' : money(row.remaining, country), row.remaining !== null && row.remaining < 0 ? styles.bad : null],
                  [t('owner.pa.colSpentPct'), row.percent === null ? '—' : formatPercent(row.percent)],
                ]}
              />
            ))}
            <StackRow
              highlight
              title={t('owner.pa.total')}
              pairs={[
                [t('owner.pa.colPlanned'), figures.budget === null ? notSet : money(figures.budget, country), styles.bold],
                [t('owner.pa.colActual'), money(figures.spent, country), styles.bold],
                [t('owner.pa.colRemaining'), figures.remaining === null ? '—' : money(figures.remaining, country), figures.overrun ? styles.bad : styles.bold],
                [t('owner.pa.colSpentPct'), figures.utilization === null ? '—' : formatPercent(figures.utilization), styles.bold],
              ]}
            />
          </Card>

          <Card icon={Receipt} title={t('owner.pa.recentExpenses')} subtitle={t('owner.pa.recentExpensesSub')}>
            {expenses.length ? expenses.map((expense) => (
              <StackRow
                key={expense.id}
                title={expense.description || '—'}
                titleRight={<Text style={[styles.stackValue, styles.bold, Number(expense.amount) < 0 ? styles.bad : null]}>{money(expense.amount, country)}</Text>}
                pairs={[
                  [t('owner.pa.colDate'), formatProjectDate(expense.expense_date, t)],
                  [t('owner.pa.colCategory'), expense.category || '—'],
                ]}
              />
            )) : <EmptyNote>{t('owner.pa.noExpenses')}</EmptyNote>}
          </Card>
        </>
      ) : null}

      {/* Remaining work and schedule */}
      <Card icon={CalendarCheck} title={t('owner.pa.workStatus')}>
        <View style={styles.statusGrid}>
          {[
            [CalendarDays, t('owner.pa.plannedStart'), formatProjectDate(project.start_date, t)],
            [CalendarCheck, t('owner.pa.plannedEnd'), formatProjectDate(project.end_date, t)],
            [Clock3, t('owner.pa.daysLeft'), daysLeft, schedule ? `${t('progress.schedule')}: ${schedule}` : null],
            [BarChart3, t('owner.pa.workItems'), workItems.length
              ? t('owner.pa.workItemsValue', { done: itemCounts.completed, ongoing: itemCounts.ongoing, pending: itemCounts.notStarted })
              : t('owner.pa.noneRecorded')],
          ].map(([Icon, label, value, note]) => (
            <View key={label} style={styles.statusBox}>
              <View style={styles.statusHead}>
                <Icon size={13} color={COLORS.slate[500]} />
                <Text style={styles.statusLabel}>{label}</Text>
              </View>
              <Text style={styles.statusValue}>{value}</Text>
              {note ? <Text style={styles.statusNote}>{note}</Text> : null}
            </View>
          ))}
        </View>
        <Text style={styles.footNote}>{t('owner.pa.delayedUnavailable')}</Text>
      </Card>
    </View>
  )
}

const styles = createStyles((c) => ({
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 56 },
  centerText: { fontSize: 13, fontWeight: '600', color: c.textMuted, textAlign: 'center' },
  retry: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  retryText: { fontSize: 12, fontWeight: '800', color: c.text },

  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: c.brandSoft },
  cardTitle: { fontSize: 14, fontWeight: '800', color: c.text },
  cardSub: { marginTop: 2, fontSize: 12, lineHeight: 18, fontWeight: '500', color: c.textMuted },
  empty: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.paper, paddingHorizontal: 14, paddingVertical: 22, textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.textMuted },
  footNote: { marginTop: 10, fontSize: 11, fontWeight: '600', color: c.textMuted },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  summary: { width: '48.5%', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 9 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  summaryIcon: { height: 22, width: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: c.brandSoft },
  summaryLabel: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: c.textMuted },
  summaryValue: { marginTop: 5, textAlign: 'center', fontSize: 15, fontWeight: '800', color: c.text },
  summaryNoteRow: { marginTop: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  summaryNote: { flexShrink: 1, fontSize: 10, fontWeight: '600' },

  donutCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  donutLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: c.textFaint, textAlign: 'center' },
  donutValue: { marginTop: 2, fontSize: 14, fontWeight: '800', color: c.text, textAlign: 'center' },
  donutPct: { fontSize: 10, fontWeight: '600', color: c.textMuted },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  legendRowActive: { backgroundColor: c.paper },
  dot: { height: 10, width: 10, borderRadius: 9999 },
  legendName: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text },
  legendValue: { fontSize: 12, fontWeight: '800', color: c.text },
  legendPct: { width: 46, textAlign: 'right', fontSize: 11, fontWeight: '600', color: c.textMuted },

  barHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  barLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: c.text },
  barRef: { fontWeight: '600', color: c.textFaint },
  barPct: { fontSize: 12, fontWeight: '800', color: c.text },
  track: { marginTop: 6, height: 10, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.borderSoft },
  trackFill: { height: '100%', borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  barFoot: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  barStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barStatusText: { fontSize: 10, fontWeight: '600' },
  barQty: { fontSize: 10, fontWeight: '600', color: c.textMuted },

  tooltip: { position: 'absolute', top: 6, width: 170, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 8 },
  tooltipTitle: { fontSize: 12, fontWeight: '800', color: c.text },
  tooltipRow: { marginTop: 3, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tooltipLabel: { fontSize: 11, color: c.textMuted },
  tooltipValue: { fontSize: 11, fontWeight: '800', color: c.text },

  stackRow: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10 },
  stackRowTotal: { marginTop: 4, borderBottomWidth: 0, borderTopWidth: 2, borderColor: c.border, borderRadius: 10, backgroundColor: c.paper, paddingHorizontal: 10 },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stackTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: c.text },
  stackPairs: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  stackPair: { width: '50%' },
  stackLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: c.textMuted },
  stackValue: { marginTop: 1, fontSize: 12, fontWeight: '600', color: c.text },
  bold: { fontWeight: '800' },
  faint: { color: c.textFaint },
  bad: { fontWeight: '800', color: '#dc2626' },
  chip: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '800' },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  statusBox: { width: '48.5%', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.paper, paddingHorizontal: 11, paddingVertical: 10 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusLabel: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: c.textMuted },
  statusValue: { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '800', color: c.text },
  statusNote: { marginTop: 2, fontSize: 11, lineHeight: 15, fontWeight: '600', color: c.textMuted },
}))
