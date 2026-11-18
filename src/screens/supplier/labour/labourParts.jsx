// What the Labour Supplier's request and assignment screens show the same way:
// the allocation rule, the request's facts and the "how many free" line.
// Ports of the web laborRequestRules.allocationSummary and the
// SupplierLaborSections RequestFacts / availabilityText.
import { View, Text } from 'react-native'
import { useLanguage } from '../../../i18n/LanguageContext'
import { ink, soft } from '../../../theme/tint'
import { createStyles } from '../../../theme/createStyles'
import { equipmentDate as labourDate } from '../equipment/equipmentParts'

export { labourDate }

/** Allocated vs required, as the backend recorded it (null before a decision). */
export function allocationSummary(request) {
  const required = Number(request?.workers_required) || 0
  const raw = request?.workers_allocated
  if (raw === null || raw === undefined || raw === '') return { allocated: null, required, shortfall: 0, partial: false }
  const allocated = Number(raw) || 0
  const shortfall = Math.max(required - allocated, 0)
  return { allocated, required, shortfall, partial: shortfall > 0 }
}

/** "Mason: 4 workers available", or why there are none to give. */
export function availabilityText(t, request, service) {
  if (!service) return t('labor.requests.notOffered', { trade: request.trade })
  if (!service.is_active) return t('labor.requests.serviceInactive', { trade: request.trade })
  return t('labor.requests.availableWorkers', { trade: request.trade, count: service.available_workers })
}

/** Weekly totals from the backend's per-trade figures (web laborWorkforceTotals). */
export function labourTotals(services = [], requests = []) {
  const active = services.filter((service) => service.is_active !== false)
  return {
    total: active.reduce((sum, service) => sum + Number(service.worker_capacity || 0), 0),
    available: active.reduce((sum, service) => sum + Number(service.available_workers || 0), 0),
    deployed: services.reduce((sum, service) => sum + Number(service.allocated_workers || 0), 0),
    pending: requests.filter((request) => request.status === 'PENDING').length,
    active: requests.filter((request) => request.status === 'ACCEPTED').length,
    completed: requests.filter((request) => request.status === 'COMPLETED').length,
  }
}

/** Trade, workers required (and allocated), start and end, plus the partial line. */
export function LabourRequestFacts({ request, showAllocated = false }) {
  const { t, td } = useLanguage()
  const allocation = allocationSummary(request)
  const facts = [
    [t('labor.field.trade'), td(request.trade) || '—'],
    [t('labor.field.workersRequired'), String(request.workers_required ?? '—')],
    ...(showAllocated ? [[t('labor.field.allocated'), String(request.workers_allocated ?? '—'), ink('#047857')]] : []),
    [t('labor.field.start'), labourDate(request.start_date)],
    [t('labor.field.end'), labourDate(request.end_date)],
  ]
  return (
    <View>
      <View style={styles.facts}>
        {facts.map(([label, value, color]) => (
          <View key={label} style={styles.fact}>
            <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
            <Text style={[styles.factValue, color ? { color } : null]} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>
      {showAllocated && allocation.partial ? (
        <Text style={[styles.partial, { backgroundColor: soft('#fffbeb', '#d97706'), color: ink('#92400e') }]}>
          {t('labor.allocation.partial', { allocated: allocation.allocated, required: allocation.required, shortfall: allocation.shortfall })}
        </Text>
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 10, borderRadius: 12, backgroundColor: c.subtle, padding: 10 },
  fact: { width: '46%', flexGrow: 1 },
  factLabel: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  factValue: { marginTop: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  partial: { marginTop: 8, overflow: 'hidden', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold' },
}))
