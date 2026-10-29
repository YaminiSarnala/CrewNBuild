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
    <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <View className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
    </View>
  )
}

function Figure({ label, value }) {
  return (
    <View className="w-[48%] rounded-xl bg-slate-50 px-3 py-2.5">
      <Text className="text-[10px] font-bold uppercase text-slate-400">{label}</Text>
      <Text className="mt-0.5 text-[15px] font-extrabold text-graphite">{value}</Text>
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
                <View className="flex-row flex-wrap justify-between gap-y-2">
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
                <View key={field} className="flex-row items-center justify-between border-b border-slate-100 py-2">
                  <Text className="text-xs font-semibold text-slate-500">{t(labelKey)}</Text>
                  <View className="items-end">
                    <Text className="text-[13px] font-extrabold text-graphite">{money(summary.adjusted_totals?.[field])}</Text>
                    {Number(summary.adjusted_totals?.[field] || 0) !== Number(summary.original_totals?.[field] || 0) ? (
                      <Text className="text-[10px] text-slate-400">{t('subscription.portfolio.original')}: {money(summary.original_totals?.[field])}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
              <View className="flex-row items-center justify-between pt-2">
                <Text className="text-xs font-extrabold text-graphite">{t('subscription.portfolio.total')}</Text>
                <Text className="text-[14px] font-extrabold text-brand-800">{money(sumCosts(summary.adjusted_totals))}</Text>
              </View>
              <ActionButton
                label={canExportAll ? t('subscription.portfolio.exportAll') : t('mobile.billing.portfolio.exportAllLocked')}
                icon={Download}
                tone="outline"
                busy={exporting === 'all'}
                disabled={!canExportAll || Boolean(exporting)}
                onPress={() => shareCsv('all', fetchPortfolioExportCsv, 'builder-portfolio.csv')}
                className="mt-3"
              />
              <Text className="mt-1 text-[11px] font-semibold text-slate-400">{t('subscription.portfolio.reportHint')}</Text>
            </Panel>
          ) : null}

          <Panel title={t('subscription.portfolio.projects')} action={<FolderKanban size={18} color="#1a5038" />}>
            <PanelState loading={loading && !data} empty={!projects.length} emptyText={t('subscription.portfolio.empty')}>
              {projects.map((row) => (
                <View key={row.project_id} className="border-b border-slate-100 py-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>{row.title || t('dash.common.project')}</Text>
                    <Text className="text-[13px] font-extrabold text-brand-800">{money(row.contract_or_budget, row.project_country)}</Text>
                  </View>
                  {row.owner_name ? <Text className="mt-0.5 text-xs font-semibold text-slate-500">{t('subscription.portfolio.colOwner')}: {row.owner_name}</Text> : null}
                  <Text className="mt-1 text-[11px] font-semibold text-slate-500">
                    {t('subscription.portfolio.colProgress')} {row.completion_percentage == null ? '—' : `${row.completion_percentage}%`} · {t('subscription.portfolio.colSpent')} {money(row.adjusted_spent ?? row.original_spent, row.project_country)}
                    {row.adjusted_spent != null && Number(row.adjusted_spent) !== Number(row.original_spent) ? ` (${t('subscription.portfolio.original')}: ${money(row.original_spent, row.project_country)})` : ''}
                  </Text>
                  <Bar value={row.completion_percentage} />
                  <Text className="mt-1 text-[11px] text-slate-400">
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
                    className="mt-2 self-start"
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