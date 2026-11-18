// Project-wide material history for the Site Engineer — port of the web
// SiteEngineerDashboard MaterialHistoryPanel: newest first, filterable by text,
// material, date range and period, paged 20 at a time. Materials changed by a
// save on this screen rise to the top with an "Added / Updated" badge.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { ChevronDown, History, RotateCcw, Search } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatMoney } from '../../utils/countryConfig'
import { formatDate, formatTime } from '../../utils/formatters'
import {
  EMPTY_HISTORY_FILTERS, filterMaterialHistory, hasActiveFilters, sortLatestFirst, summarizeMaterialHistory,
} from '../../utils/siteMaterialHistory'
import { SegmentTabs, SelectChip } from '../../components/builder/BuilderUi'
import { DateField } from '../../components/form'
import { COLORS } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const PAGE_SIZE = 20
const formatQty = (value) => { const number = Number(value || 0); return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2))) }

export default function MaterialHistoryPanel({ entries, filters, setFilters, touched, todayKey, country, unitLabel, collapsible = false, open = true, onToggle = null }) {
  const { t, td } = useLanguage()
  const [limit, setLimit] = useState(PAGE_SIZE)
  const labelOf = useCallback((name) => td(name), [td])
  const filtered = useMemo(
    () => sortLatestFirst(filterMaterialHistory(entries, filters, { todayKey, touched, labelOf }), touched),
    [entries, filters, todayKey, touched, labelOf],
  )
  const summary = useMemo(() => summarizeMaterialHistory(filtered), [filtered])
  const materialOptions = useMemo(() => [...new Set(entries.map((entry) => entry.material))].sort((a, b) => a.localeCompare(b)), [entries])
  const active = hasActiveFilters(filters)
  useEffect(() => { setLimit(PAGE_SIZE) }, [filters])
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const visible = filtered.slice(0, limit)
  const money = (value) => formatMoney(value, country)
  const periods = [
    { id: 'all', label: t('se.hist.allTime') },
    { id: '7d', label: t('se.hist.last7') },
    { id: '30d', label: t('se.hist.last30') },
    ...(Object.keys(touched).length > 0 || filters.recent === 'session' ? [{ id: 'session', label: t('se.hist.session') }] : []),
  ]
  let previousDate = ''

  const heading = (
    <View style={styles.headingRow}>
      <History size={16} color={COLORS.brand[700]} />
      <Text style={styles.title}>{t('se.hist.title')}</Text>
      {collapsible ? <ChevronDown size={16} color={COLORS.slate[500]} style={open ? { transform: [{ rotate: '180deg' }] } : null} /> : null}
    </View>
  )

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          {collapsible ? <Pressable onPress={onToggle}>{heading}</Pressable> : heading}
          <Text style={styles.subtitle}>{t('se.hist.subtitle')}</Text>
        </View>
        {open && active ? (
          <Pressable onPress={() => setFilters(EMPTY_HISTORY_FILTERS)} style={styles.reset}>
            <RotateCcw size={13} color={COLORS.slate[600]} />
            <Text style={styles.resetText}>{t('se.hist.reset')}</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View>
          {entries.length > 0 ? (
            <View style={styles.filters}>
              <View style={styles.search}>
                <Search size={15} color={COLORS.slate[400]} />
                <TextInput
                  value={filters.search}
                  onChangeText={(value) => setFilter('search', value)}
                  placeholder={t('se.hist.searchPlaceholder')}
                  placeholderTextColor={COLORS.slate[400]}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.row}>
                <SelectChip
                  placeholder={t('se.hist.allMaterials')}
                  value={filters.material}
                  onChange={(value) => setFilter('material', value)}
                  options={materialOptions.map((name) => ({ value: name, label: td(name) }))}
                />
              </View>
              <View style={styles.dates}>
                <DateField label={t('se.hist.from')} value={filters.from} max={filters.to || undefined} onChange={(value) => setFilter('from', value)} containerStyle={styles.dateField} />
                <DateField label={t('se.hist.to')} value={filters.to} min={filters.from || undefined} onChange={(value) => setFilter('to', value)} containerStyle={styles.dateField} />
              </View>
              <Text style={styles.label}>{t('se.hist.period')}</Text>
              <SegmentTabs dense tabs={periods} active={filters.recent} onChange={(value) => setFilter('recent', value)} />
            </View>
          ) : null}

          {filtered.length > 0 ? (
            <View style={styles.summary}>
              <Text style={styles.summaryText}>{t('se.hist.entries', { count: summary.entryCount })}</Text>
              <Text style={styles.summaryText}>{t('se.hist.materials', { count: summary.materialCount })}</Text>
              {summary.quantity ? <Text style={styles.summaryText}>{t('se.hist.totalQty', { qty: formatQty(summary.quantity.amount), unit: unitLabel(summary.quantity.unit) })}</Text> : null}
              {summary.totalCost > 0 ? <Text style={[styles.summaryText, styles.strong]}>{t('se.hist.totalCost', { amount: money(summary.totalCost) })}</Text> : null}
              {summary.unpricedCount > 0 ? <Text style={styles.faint}>{t('se.hist.unpriced', { count: summary.unpricedCount })}</Text> : null}
            </View>
          ) : null}

          {!entries.length ? <Text style={styles.empty}>{t('se.hist.empty')}</Text> : null}
          {entries.length > 0 && !filtered.length ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('se.hist.emptyFiltered')}</Text>
              <Pressable onPress={() => setFilters(EMPTY_HISTORY_FILTERS)}><Text style={styles.link}>{t('se.hist.reset')}</Text></Pressable>
            </View>
          ) : null}

          {visible.length > 0 ? (
            <View style={styles.list}>
              {visible.map((entry) => {
                const change = touched[entry.key]?.change
                const showDate = entry.workDate !== previousDate
                previousDate = entry.workDate
                const sameDay = entry.recordedAt && String(entry.recordedAt).slice(0, 10) === entry.workDate
                const recorded = entry.recordedAt
                  ? t('se.hist.recordedAt', { time: sameDay ? formatTime(entry.recordedAt) : `${formatDate(entry.recordedAt, '')} ${formatTime(entry.recordedAt)}` })
                  : ''
                return (
                  <View key={entry.key} style={[styles.item, change ? styles.itemChanged : null]}>
                    {showDate ? <Text style={styles.date}>{formatDate(entry.workDate, entry.workDate, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</Text> : null}
                    <View style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name}>{td(entry.material)}</Text>
                          {change ? <Text style={styles.badge}>{t(change === 'added' ? 'se.hist.added' : 'se.hist.updated')}</Text> : null}
                        </View>
                        <Text style={styles.meta} numberOfLines={1}>{[entry.workTitle ? td(entry.workTitle) : '', recorded].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.name}>{`${formatQty(entry.quantity)} ${unitLabel(entry.unit)}`}</Text>
                        <Text style={styles.meta}>{entry.rate != null ? `${money(entry.rate)}/${unitLabel(entry.unit)} · ${money(entry.amount)}` : t('se.hist.noRate')}</Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : null}
          {filtered.length > visible.length ? (
            <Pressable onPress={() => setLimit((current) => current + PAGE_SIZE)} style={styles.more}>
              <Text style={styles.moreText}>{t('se.hist.showMore', { count: filtered.length - visible.length })}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  panel: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 15, fontWeight: '800', color: c.text },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: '600', color: c.textMuted },
  reset: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 9 },
  resetText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  filters: { marginTop: 10.5, gap: 7 },
  search: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 9 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text },
  row: { flexDirection: 'row' },
  dates: { flexDirection: 'row', gap: 7 },
  dateField: { flex: 1 },
  label: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.textMuted },
  summary: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', columnGap: 10.5, rowGap: 3 },
  summaryText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  strong: { color: c.text },
  faint: { fontSize: 12, fontWeight: '600', color: c.textFaint },
  empty: { marginTop: 10.5, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 14, paddingVertical: 28, textAlign: 'center', fontSize: 13, fontWeight: '700', color: c.textMuted },
  emptyBox: { marginTop: 10.5, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 14, paddingVertical: 24 },
  emptyText: { fontSize: 13, fontWeight: '700', color: c.textMuted },
  link: { marginTop: 7, fontSize: 12, fontWeight: '800', color: c.brandText, textDecorationLine: 'underline' },
  list: { marginTop: 10.5, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  item: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10.5, paddingVertical: 9 },
  itemChanged: { backgroundColor: c.brandSoft },
  date: { marginBottom: 3.5, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  name: { fontSize: 13, fontWeight: '800', color: c.text },
  badge: { overflow: 'hidden', borderRadius: 9999, backgroundColor: soft('#d1fae5', '#065f46'), paddingHorizontal: 7, paddingVertical: 1.5, fontSize: 10, fontWeight: '800', color: ink('#065f46') },  meta: { marginTop: 2, fontSize: 11, fontWeight: '600', color: c.textMuted },
  more: { marginTop: 10.5, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border },
  moreText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
}))