// Port of web subscription/BuilderPortfolioSection.jsx — the Professional /
// Business portfolio (GET /builder/portfolio). The server decides access: a
// refusal (403 with detail.code) shows the locked notice with the way to the
// plans. CSV reports (GET /projects/{id}/summary.csv and
// /builder/portfolio/export.csv) are fetched and saved as .csv files, then
// handed to the share sheet (save to Files / Drive, open, send).
// Strings use the web section's translation keys (subscription.portfolio.*).
import { useCallback, useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Activity, Download, FolderKanban } from 'lucide-react-native'
import { Panel, PanelState } from '../../components/DashboardShell'
import {
  ActionButton, LockedFeature, Notice, PremiumBadge, Section, StackScreenShell,
} from '../../components/builder/BuilderUi'
import useBuilderSubscription from '../../hooks/useBuilderSubscription'
import {
  fetchBuilderPortfolio, fetchPortfolioExportCsv, fetchProjectSummaryCsv, normalizeCsvError,
} from '../../api/subscription'
import { hasFeature, lockedMessage, lockedReason } from '../../utils/subscriptionFormat'
import { formatDisplayDate, money } from '../../utils/builderHelpers'
import { shareCsvFile } from '../../utils/shareCsv'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'

// [field, labelKey] as the web's COST_FIELDS.
const COST_FIELDS = [
  ['labour_cost', 'se.labourCost'],
  ['material_cost', 'se.materialCost'],
  ['equipment_cost', 'se.equipmentCost'],
  ['total_expenses', 'se.otherExpenses'],
]

const sumCosts = (totals) => COST_FIELDS.reduce((total, [field]) => total + Number(totals?.[field] || 0), 0)

function Bar({ value }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <View style={styles.view}>
      <View style={[styles.view2, { width: `${width}%` }]} />
    </View>
  )
}

function Figure({ label, value }) {
  return (
    <View style={styles.view3}>
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.text2}>{value}</Text>
    </View>
  )
}

export default function BuilderPortfolioScreen({ navigation }) {
  const { t } = useLanguage()
  const { status } = useBuilderSubscription()
  const [data, setData] = useState(null)
  const [locked, setLocked] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [exporting, setExporting] = useState('')
  const statusKey = `${status?.status}-${status?.plan_code}`

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    setLoadFailed(false)
    try {
      setData(await fetchBuilderPortfolio())
      setLocked(null)
    } catch (error) {
      const reason = lockedReason(error)
      if (reason) { setLocked(reason); setData(null) } else setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, statusKey])

  const viewPlans = () => navigation.navigate('BuilderSubscription')

  const shareCsv = async (key, task, title) => {
    setMessage('')
    setExporting(key)
    try {
      const csv = await task()
      await shareCsvFile(csv, title)
    } catch (error) {
      const reason = lockedReason(normalizeCsvError(error))
      setMessage(reason ? lockedMessage(reason, t) : t('subscription.portfolio.downloadFailed'))
    } finally {
      setExporting('')
    }
  }

  const advanced = Boolean(data?.advanced)
  const summary = data?.summary
  const projects = Array.isArray(data?.projects) ? data.projects : []
  const canExportProject = hasFeature(status, 'project_summary_export')
  const canExportAll = hasFeature(status, 'consolidated_export')

  return (
    <StackScreenShell
      title={t('subscription.portfolio.title')}
      subtitle={t(advanced ? 'subscription.portfolio.subtitle.BUSINESS' : 'subscription.portfolio.subtitle.PROFESSIONAL')}
      onBack={() => navigation.goBack()}
      refreshing={loading && !!data}
      onRefresh={load}
      right={<PremiumBadge status={status} />}
    >
      {locked ? (
        <Section><LockedFeature reason={locked} onViewPlans={viewPlans} /></Section>
      ) : (
        <>
          <Section><Notice tone="error" text={message} /></Section>
          <Panel title={t('mobile.billing.portfolio.summary')} action={<Activity size={18} color="#1a5038" />}>
            <PanelState
              loading={loading && !data}
              error={loadFailed ? t('mobile.billing.portfolio.loadFailed') : ''}
              empty={!summary}
              emptyText={t('subscription.portfolio.empty')}
            >
              {summary ? (
                <View style={styles.view4}>
                  <Figure label={t('subscription.portfolio.projects')} value={String(summary.project_count ?? 0)} />
                  <Figure label={t('subscription.portfolio.activeProjects')} value={String(summary.active_projects ?? 0)} />
                  <Figure label={t('subscription.portfolio.avgCompletion')} value={summary.average_completion == null ? '—' : `${summary.average_completion}%`} />
                  <Figure label={t('subscription.portfolio.recordedDays')} value={String(summary.recorded_days ?? 0)} />
                  <Figure label={t('subscription.portfolio.photos')} value={String(summary.photo_count ?? 0)} />
                  <Figure label={t('subscription.portfolio.totalBudget')} value={money(summary.contract_or_budget, projects[0]?.project_country)} />
                </View>
              ) : null}
            </PanelState>
          </Panel>

          {advanced && summary ? (
            <Panel title={t('subscription.portfolio.costSummary')}>
              {COST_FIELDS.map(([field, labelKey]) => (
                <View key={field} style={styles.view5}>
                  <Text style={styles.text3}>{t(labelKey)}</Text>
                  <View style={styles.view6}>
                    <Text style={styles.text4}>{money(summary.adjusted_totals?.[field])}</Text>
                    {Number(summary.adjusted_totals?.[field] || 0) !== Number(summary.original_totals?.[field] || 0) ? (
                      <Text style={styles.text5}>{t('subscription.portfolio.original')}: {money(summary.original_totals?.[field])}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
              <View style={styles.view7}>
                <Text style={styles.text6}>{t('subscription.portfolio.total')}</Text>
                <Text style={styles.text7}>{money(sumCosts(summary.adjusted_totals))}</Text>
              </View>
              <ActionButton
                label={canExportAll ? t('subscription.portfolio.exportAll') : t('mobile.billing.portfolio.exportAllLocked')}
                icon={Download}
                tone="outline"
                busy={exporting === 'all'}
                disabled={!canExportAll || Boolean(exporting)}
                onPress={() => shareCsv('all', fetchPortfolioExportCsv, 'builder-portfolio.csv')}
                style={styles.actionButton}
              />
              <Text style={styles.text8}>{t('subscription.portfolio.reportHint')}</Text>
            </Panel>
          ) : null}

          <Panel title={t('subscription.portfolio.projects')} action={<FolderKanban size={18} color="#1a5038" />}>
            <PanelState loading={loading && !data} empty={!projects.length} emptyText={t('subscription.portfolio.empty')}>
              {projects.map((row) => (
                <View key={row.project_id} style={styles.view8}>
                  <View style={styles.view9}>
                    <Text style={styles.text9} numberOfLines={1}>{row.title || t('dash.common.project')}</Text>
                    <Text style={styles.text10}>{money(row.contract_or_budget, row.project_country)}</Text>
                  </View>
                  {row.owner_name ? <Text style={styles.text11}>{t('subscription.portfolio.colOwner')}: {row.owner_name}</Text> : null}
                  <Text style={styles.text12}>
                    {t('subscription.portfolio.colProgress')} {row.completion_percentage == null ? '—' : `${row.completion_percentage}%`} · {t('subscription.portfolio.colSpent')} {money(row.adjusted_spent ?? row.original_spent, row.project_country)}
                    {row.adjusted_spent != null && Number(row.adjusted_spent) !== Number(row.original_spent) ? ` (${t('subscription.portfolio.original')}: ${money(row.original_spent, row.project_country)})` : ''}
                  </Text>
                  <Bar value={row.completion_percentage} />
                  <Text style={styles.text13}>
                    {t('subscription.portfolio.recordedDays')}: {row.recorded_days || 0}{row.adjusted_days ? ` · ${t('subscription.portfolio.colCorrected')}: ${row.adjusted_days}` : ''} · {t('subscription.portfolio.colLastRecord')}: {formatDisplayDate(row.last_record_date, '—')}
                  </Text>
                  <ActionButton
                    small
                    tone="brandOutline"
                    icon={Download}
                    label={canExportProject ? t('mobile.billing.portfolio.downloadProjectCsv') : t('mobile.billing.portfolio.exportProjectLocked')}
                    busy={exporting === `p-${row.project_id}`}
                    disabled={!canExportProject || Boolean(exporting)}
                    onPress={() => shareCsv(`p-${row.project_id}`, () => fetchProjectSummaryCsv(row.project_id), `project-${row.project_id}-summary.csv`)}
                    style={styles.actionButton2}
                  />
                </View>
              ))}
            </PanelState>
          </Panel>
          <Section>
            <ActionButton label={t('subscription.portfolio.openProjects')} tone="outline" onPress={() => navigation.navigate('ContractorHome', { screen: 'ContractorProjectsTab' })} />
          </Section>
        </>
      )}
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  view: { marginTop: 3.5, height: 5.25, width: '100%', overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  view2: { height: '100%', borderRadius: 9999, backgroundColor: '#10b981' },
  view3: { width: '48%', borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: c.textFaint },
  text2: { marginTop: 1.75, fontSize: 15, fontWeight: '800', color: c.text },
  view4: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7 },
  view5: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 7 },
  text3: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view6: { alignItems: 'flex-end' },
  text4: { fontSize: 13, fontWeight: '800', color: c.text },
  text5: { fontSize: 10, color: c.textFaint },
  view7: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 7 },
  text6: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.text },
  text7: { fontSize: 14, fontWeight: '800', color: c.brandTextStrong },
  actionButton: { marginTop: 10.5 },
  text8: { marginTop: 3.5, fontSize: 11, fontWeight: '600', color: c.textFaint },
  view8: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view9: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text9: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  text10: { fontSize: 13, fontWeight: '800', color: c.brandTextStrong },
  text11: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  text12: { marginTop: 3.5, fontSize: 11, fontWeight: '600', color: c.textMuted },
  text13: { marginTop: 3.5, fontSize: 11, color: c.textFaint },
  actionButton2: { marginTop: 7, alignSelf: 'flex-start' },
}))
