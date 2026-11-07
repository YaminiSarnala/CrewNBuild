// Port of web pages/owner/OwnerProjectAnalysisPanel.jsx — the back of an
// owner's project card: budget, recorded spend and schedule for that one
// project, from the cost summary. Figures come from analysisFigures
// (ownerProjectAnalysis.js); nothing here invents a value.
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { AlertTriangle, RotateCcw } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useTheme } from '../../theme/ThemeContext'
import { formatPercent, scheduleText, scheduleWidth } from '../../utils/builderHelpers'
import { analysisFigures } from './ownerProjectAnalysis'
import { money } from './ownerHelpers'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const USED = '#126b45'
const OVER = '#dc2626'

// Budget used against remaining, with the utilization in the centre.
function BudgetDonut({ utilization, track }) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const share = utilization === null ? 0 : Math.min(100, utilization)
  const color = utilization !== null && utilization > 100 ? OVER : USED
  return (
    <View style={{ width: 60, height: 60 }}>
      <Svg width={60} height={60}>
        <G rotation={-90} origin="30, 30">
          <Circle cx={30} cy={30} r={radius} fill="none" stroke={track} strokeWidth={7} />
          {share > 0 ? (
            <Circle cx={30} cy={30} r={radius} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${(share / 100) * circumference} ${circumference}`} />
          ) : null}
        </G>
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={styles.donutText}>{utilization === null ? '–' : formatPercent(utilization)}</Text>
      </View>
    </View>
  )
}

function Metric({ label, value, bad }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.metricValue, bad ? styles.bad : null]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

export default function OwnerProjectAnalysisPanel({ project, country, state, onRetry, onBack }) {
  const { t } = useLanguage()
  const { isDark } = useTheme()
  const figures = state?.status === 'ready' ? analysisFigures(state.data?.dashboard) : null
  const notAvailable = t('progress.notAvailable')
  const schedule = scheduleText(project, t)
  const track = isDark ? '#334155' : '#e2e8f0'

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>{t('owner.analysis.title')}</Text>
        <Pressable onPress={onBack} style={styles.smallButton}>
          <RotateCcw size={12} color={COLORS.graphite} />
          <Text style={styles.smallButtonText}>{t('owner.analysis.back')}</Text>
        </Pressable>
      </View>

      {state?.status === 'ready' && !figures ? <Text style={styles.centerText}>{notAvailable}</Text> : null}
      {!state || state.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={COLORS.brand[700]} />
          <Text style={styles.centerText}>{t('owner.analysis.loading')}</Text>
        </View>
      ) : null}
      {state?.status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.centerText}>{t('owner.analysis.error')}</Text>
          <Pressable onPress={onRetry} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>{t('owner.analysis.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {figures ? (
        <View style={{ marginTop: 10 }}>
          <View style={styles.row}>
            <BudgetDonut utilization={figures.utilization} track={track} />
            <View style={styles.metrics}>
              <Metric label={t('owner.analysis.budget')} value={figures.budget === null ? notAvailable : money(figures.budget, country)} />
              <Metric label={t('owner.analysis.spent')} value={money(figures.spent, country)} />
              <Metric
                label={t('owner.analysis.remaining')}
                value={figures.remaining === null ? notAvailable : figures.overrun ? `-${money(figures.overrun, country)}` : money(figures.remaining, country)}
                bad={figures.overrun > 0}
              />
              <Metric label={t('owner.analysis.utilization')} value={figures.utilization === null ? notAvailable : formatPercent(figures.utilization)} bad={figures.overrun > 0} />
            </View>
          </View>
          {figures.overrun > 0 ? (
            <View style={styles.overrun}>
              <AlertTriangle size={11} color={OVER} />
              <Text style={[styles.overrunText]}>{t('owner.analysis.overrun', { amount: money(figures.overrun, country) })}</Text>
            </View>
          ) : null}

          {/* Spending by the categories the site records, as one stacked bar. */}
          <View style={{ marginTop: 10 }}>
            <Text style={styles.metricLabel}>{t('owner.analysis.breakdown')}</Text>
            {figures.categories.length ? (
              <>
                <View style={[styles.stack, { backgroundColor: track }]}>
                  {figures.categories.map((category) => (
                    <View key={category.key} style={{ height: '100%', width: `${(category.value / figures.spent) * 100}%`, backgroundColor: category.color }} />
                  ))}
                </View>
                <View style={styles.legend}>
                  {figures.categories.map((category) => (
                    <View key={category.key} style={styles.legendItem}>
                      <View style={[styles.dot, { backgroundColor: category.color }]} />
                      <Text style={styles.legendText}>
                        {`${t(category.labelKey)} ${formatPercent(Math.round((category.value / figures.spent) * 1000) / 10)}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.legendText, { marginTop: 2 }]}>{t('owner.analysis.noSpend')}</Text>
            )}
          </View>

          {/* The same schedule figure the front of the card draws. */}
          <View style={{ marginTop: 10 }}>
            <View style={[styles.scheduleTrack, { backgroundColor: track }]}>
              <View style={[styles.scheduleFill, { width: `${scheduleWidth(project)}%` }]} />
            </View>
            <Text style={styles.legendText} numberOfLines={1}>{`${t('progress.schedule')}: ${schedule || notAvailable}`}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: c.text },
  smallButton: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  smallButtonText: { fontSize: 11, fontWeight: '800', color: c.text },
  center: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  centerText: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: c.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  donutCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  donutText: { fontSize: 11, fontWeight: '800', color: c.text },
  metrics: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  metric: { width: '50%', paddingRight: 8 },
  metricLabel: { fontSize: 10, fontWeight: '600', color: c.textMuted },
  metricValue: { fontSize: 12, fontWeight: '700', color: c.text },
  bad: { color: OVER },
  overrun: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  overrunText: { flex: 1, fontSize: 10, fontWeight: '700', color: OVER },
  stack: { marginTop: 4, height: 8, flexDirection: 'row', overflow: 'hidden', borderRadius: 9999 },
  legend: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { height: 8, width: 8, borderRadius: 9999 },
  legendText: { fontSize: 10, fontWeight: '600', color: c.textMuted },
  scheduleTrack: { height: 4, overflow: 'hidden', borderRadius: 9999 },
  scheduleFill: { height: '100%', borderRadius: 9999, backgroundColor: '#10b981' },
}))
