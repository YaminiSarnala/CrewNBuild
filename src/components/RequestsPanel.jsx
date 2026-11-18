// Port of the web components/dashboard/RequestsPanel.jsx (variant "command",
// compact): status tabs (All / New / Accepted / Rejected / Withdrawn, pending
// first then newest), one card per request with Accept and Reject on a pending
// request the reader received, and View Details with the sender's profile and
// the request's details. Contacts stay hidden until the request is accepted.
import { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { BadgeCheck, Building2, CalendarDays, MapPin, Phone, Star, Wallet } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { imageSource } from '../api/client'
import { userAvatarSource } from '../utils/avatars'
import { formatMoney } from '../utils/countryConfig'
import { formatDate } from '../utils/formatters'
import { constructionTypeLabel, requestTypeLabel } from '../utils/roleLabels'
import { requestStatusText } from '../utils/builderHelpers'
import { SERVICE_OPTION_KEYS, SUPPLIER_CATEGORY_KEYS, optionLabel } from '../i18n/optionKeys'
import { SegmentTabs } from './builder/BuilderUi'
import { COLORS } from '../theme/tokens'
import { ink, line, soft } from '../theme/tint'
import { createStyles } from '../theme/createStyles'

const SENDER_ROLE_KEYS = { OWNER: 'role.owner', CONTRACTOR: 'role.contractor', SUPPLIER: 'role.supplier', ENGINEER: 'role.engineer' }
const FINAL_TONES = {
  accepted: { bg: '#f0f6f2', border: '#c3dccd', fg: '#1a5038' },
  rejected: { bg: '#fef2f2', border: '#fecaca', fg: '#dc2626' },
  other: { bg: '#f0f6f2', border: '#e1eee6', fg: '#1a5038' },
}

const profileList = (value) => (Array.isArray(value) ? value.filter(Boolean) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean))
const sortValue = (request) => ({ pendingRank: request.status === 'pending' ? 0 : 1, createdAt: Date.parse(request.created_at_iso || request.created_at || '') || 0 })

function Field({ label, value }) {
  return (
    <View style={styles.rp1}>
      <Text style={styles.rp2}>{label}</Text>
      <Text style={styles.rp3}>{value}</Text>
    </View>
  )
}

export default function RequestsPanel({ requestList, onAccept, onReject }) {
  const { t, td } = useLanguage()
  const [activeStatus, setActiveStatus] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const filtered = useMemo(() => requestList
    .filter((request) => activeStatus === 'all' || request.status === activeStatus)
    .sort((a, b) => {
      const first = sortValue(a)
      const second = sortValue(b)
      if (first.pendingRank !== second.pendingRank) return first.pendingRank - second.pendingRank
      return second.createdAt - first.createdAt
    }), [activeStatus, requestList])

  const count = (status) => requestList.filter((request) => request.status === status).length
  const tabs = [
    { id: 'all', label: t('ui.requests.title'), count: requestList.length },
    { id: 'pending', label: t('ui.requests.new'), count: count('pending') },
    { id: 'accepted', label: t('ui.requests.accepted'), count: count('accepted') },
    { id: 'rejected', label: t('ui.requests.rejected'), count: count('rejected') },
    { id: 'withdrawn', label: t('ui.shared.statusWithdrawn'), count: count('withdrawn') },
  ]
  const tagLabel = (item, senderRole) => {
    const label = optionLabel(t, senderRole === 'SUPPLIER' ? SUPPLIER_CATEGORY_KEYS : SERVICE_OPTION_KEYS, item)
    return label === item ? td(item) : label
  }
  const notSet = t('ui.requests.notSet')

  return (
    <View>
      <View style={styles.rp4}><SegmentTabs tabs={tabs} active={activeStatus} onChange={setActiveStatus} dense /></View>
      {filtered.map((request) => {
        const pending = request.status === 'pending'
        const expanded = expandedId === request.id
        const canAct = pending && !request.is_sender
        const canViewContact = request.status === 'accepted'
        const tone = FINAL_TONES[request.status] || FINAL_TONES.other
        const amount = Number(request.property_price || 0) > 0 ? request.property_price : Number(request.budget || 0) > 0 ? request.budget : 0
        const services = profileList(request.profile_services || request.profile_categories)
        return (
          <View key={request.id} style={styles.rp5}>
            <View style={styles.rp6}>
              <View style={styles.rp7}>
                <View style={styles.rp8}>
                  <Image source={request.property_image_url ? imageSource(request.property_image_url) : userAvatarSource(request)} style={{ width: 56, height: 56 }} contentFit="cover" />
                </View>
                <View style={styles.rp9}>
                  <Text style={styles.rp10} numberOfLines={1}>{td(request.property_title || request.project_title) || td(request.sender_name)}</Text>
                  <View style={styles.rp11}>
                    <MapPin size={13} color={COLORS.slate[500]} />
                    <Text style={styles.rp12} numberOfLines={1}>{td(request.project_address || request.sender_address || request.project_pincode) || t('ui.requests.locationNotSet')}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.rp13}>
                <View style={styles.rp14}>
                  <Building2 size={14} color={COLORS.brand[700]} />
                  <Text style={styles.rp15} numberOfLines={1}>{td(request.profile_title || request.sender_name)}</Text>
                </View>
                {amount ? (
                  <View style={styles.rp14}>
                    <Wallet size={14} color={COLORS.brand[700]} />
                    <Text style={styles.rp16}>{formatMoney(amount, request.project_country)}</Text>
                  </View>
                ) : null}
                <View style={styles.rp14}>
                  <CalendarDays size={14} color={COLORS.brand[700]} />
                  <Text style={styles.rp17}>{formatDate(request.created_at_iso, request.created_at || '')}</Text>
                </View>
                {Number(request.quotation_amount || 0) > 0 ? (
                  <Text style={styles.rp18}>
                    {t('ui.requests.quotation', { amount: formatMoney(request.quotation_amount, request.project_country) })}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rp19}>
                <Pressable onPress={() => setExpandedId(expanded ? null : request.id)} style={styles.rp20}>
                  <Text style={styles.rp3}>{t('ui.requests.viewDetails')}</Text>
                </Pressable>
                {canAct ? (
                  <>
                    <Pressable onPress={() => onAccept(request.id)} style={styles.rp21}>
                      <Text style={styles.rp22}>{t('ui.requests.accept')}</Text>
                    </Pressable>
                    <Pressable onPress={() => onReject(request.id)} style={styles.rp23}>
                      <Text style={styles.rp24}>{t('ui.requests.reject')}</Text>
                    </Pressable>
                  </>
                ) : (
                                   <View style={[styles.rp25, { backgroundColor: soft(tone.bg, tone.fg), borderColor: line(tone.border, tone.fg) }]}>
                    <Text style={[styles.rp26, { color: ink(tone.fg) }]}>{requestStatusText(request.status, t)}</Text>
                  </View>
                )}
              </View>
            </View>

            {expanded ? (
              <View style={styles.rp27}>
                <View style={styles.rp28}>
                  <View style={styles.rp29}>
                    <Image source={userAvatarSource(request)} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" />
                    <View style={styles.rp9}>
                      <Text style={styles.rp30} numberOfLines={2}>{td(request.profile_title || request.sender_name)}</Text>
                      <View style={styles.rp31}>
                        <BadgeCheck size={11} color={COLORS.brand[700]} />
                        <Text style={styles.rp32}>
                          {request.profile_subtitle ? td(request.profile_subtitle) : (SENDER_ROLE_KEYS[request.sender_role] ? t(SENDER_ROLE_KEYS[request.sender_role]) : td(request.sender_role))}
                        </Text>
                      </View>
                      {request.profile_name ? <Text style={styles.rp33}>{td(request.profile_name)}</Text> : null}
                    </View>
                  </View>
                  {request.profile_about ? <Text style={styles.rp34} numberOfLines={3}>{td(request.profile_about)}</Text> : null}
                  <View style={styles.rp19}>
                    <View style={styles.rp35}>
                      <Text style={styles.rp36}>{t('ui.requests.rating')}</Text>
                      <View style={styles.rp37}><Star size={13} color={ink('#d4a017')} fill="#d4a017" /><Text style={styles.rp38}>{request.profile_rating || 0}</Text>
                      </View>                  
                        </View>
                    <View style={styles.rp35}>
                      <Text style={styles.rp36}>{t('ui.requests.pincode')}</Text>
                      <Text style={styles.rp38}>{request.profile_pincode || request.sender_pincode || notSet}</Text>
                    </View>
                    <View style={styles.rp35}>
                      <Text style={styles.rp36}>{t('ui.requests.phone')}</Text>
                      <View style={styles.rp37}>
                        <Phone size={13} color={COLORS.graphite} />
                        <Text style={[styles.rp38, canViewContact ? null : { opacity: 0.3 }]}>
                          {canViewContact ? (request.profile_phone || notSet) : t('ui.requests.locked')}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {!canViewContact ? <Text style={styles.rp39}>{t('ui.requests.acceptToView')}</Text> : null}
                  {Number(request.profile_experience_years || 0) > 0 ? (
                    <View style={styles.rp40}>
                      <View style={styles.rp41}>
                        <Text style={styles.rp36}>{t('ui.requests.experience')}</Text>
                        <Text style={styles.rp38}>{t('ui.requests.years', { years: request.profile_experience_years })}</Text>
                      </View>
                      <View style={styles.rp41}>
                        <Text style={styles.rp36}>{t('ui.requests.completedProjects')}</Text>
                        <Text style={styles.rp38}>{request.profile_completed_projects || 0}</Text>
                      </View>
                    </View>
                  ) : null}
                  {services.length ? (
                    <View style={styles.rp19}>
                      {services.map((item) => (
                        <View key={item} style={styles.rp42}><Text style={styles.rp43}>{tagLabel(item, request.sender_role)}</Text></View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={styles.rp44}>
                  <Text style={styles.rp30}>{t('ui.requests.requestDetails')}</Text>
                  <View style={styles.rp45}>
                    <Field label={t('ui.requests.requestType')} value={requestTypeLabel(request.request_type, t) || notSet} />
                    <Field label={t('ui.requests.construction')} value={constructionTypeLabel(request.construction_type, t) || notSet} />
                    <Field label={t('ui.requests.building')} value={td(request.building_type) || notSet} />
                    <Field label={t('ui.requests.pincode')} value={request.project_pincode || request.sender_pincode || notSet} />
                  </View>
                  <Text style={styles.rp2}>{t('ui.requests.address')}</Text>
                  <Text style={styles.rp3}>{td(request.project_address || request.sender_address) || notSet}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )
      })}
      {!filtered.length ? (
        <View style={styles.rp46}>
          <Text style={styles.rp30}>{t('ui.requests.noRequests')}</Text>
          <Text style={styles.rp47}>{t('ui.requests.noRequestsSub')}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  rp1: { marginBottom: 7, width: '48%' },
  rp2: { fontSize: 11, color: c.textFaint },
  rp3: { fontSize: 13, fontWeight: '700', color: c.text },
  rp4: { marginBottom: 10.5 },
  rp5: { marginBottom: 10.5, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  rp6: { padding: 14 },
  rp7: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  rp8: { height: 49, width: 49, overflow: 'hidden', borderRadius: 12, backgroundColor: c.brandSoft },
  rp9: { flex: 1 },
  rp10: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: c.text },
  rp11: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  rp12: { flex: 1, fontSize: 12, lineHeight: 16, color: c.textMuted },
  rp13: { marginTop: 10.5, gap: 5.25 },
  rp14: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rp15: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text },
  rp16: { fontSize: 13, fontWeight: '600', color: c.text },
  rp17: { fontSize: 13, color: c.textMuted },
  rp18: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, borderColor: line('#d1fae5', '#047857'), backgroundColor: soft('#ecfdf5', '#047857'), paddingHorizontal: 8.75, paddingVertical: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: ink('#047857') },  rp19: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  rp20: { height: 35, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5 },
  rp21: { height: 35, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#134127', paddingHorizontal: 10.5 },
  rp22: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  rp23: { height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: line('#ffe4e6', '#e11d48'), backgroundColor: soft('#fff1f2', '#e11d48'), paddingHorizontal: 14 },
  rp24: { fontSize: 13, fontWeight: '700', color: ink('#e11d48') },
  rp25: { height: 35, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 10.5 },
  rp26: { fontSize: 13, fontWeight: '800' },
  rp27: { borderTopWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, padding: 10.5 },
  rp28: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  rp29: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5 },
  rp30: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, lineHeight: 24, color: c.text },
  rp31: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 3.5, alignSelf: 'flex-start', borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 7, paddingVertical: 3.5 },
  rp32: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: c.brandText },
  rp33: { marginTop: 3.5, fontSize: 14, lineHeight: 20, fontWeight: '600', color: c.textMuted },
  rp34: { marginTop: 7, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  rp35: { borderRadius: 8, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  rp36: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textFaint },
  rp37: { flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  rp38: { fontWeight: '700', color: c.text },
  rp39: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textFaint },
  rp40: { marginTop: 10.5, flexDirection: 'row', gap: 7 },
  rp41: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  rp42: { borderRadius: 9999, backgroundColor: soft('#fffbeb', '#b45309'), paddingHorizontal: 10.5, paddingVertical: 3.5 },  rp43: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.brandTextStrong },
  rp44: { marginTop: 10.5, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  rp45: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  rp46: { alignItems: 'center', paddingHorizontal: 17.5, paddingVertical: 42 },
  rp47: { marginTop: 3.5, textAlign: 'center', fontSize: 14, lineHeight: 20, color: c.textMuted },
}))