// Find Clients for a Material Supplier, opened from the Dashboard: the web
// SupplierFindClientsSection.
//
// House Owner | Builder tabs. Each shows the requests that client type sent
// this supplier and are still waiting ("pending join requests"), then the
// nearby clients (GET /suppliers/find-clients) the supplier can send a request
// to. A client already linked by a request -- either way, any outcome except
// withdrawn -- is not a prospect any more and is left out; the request itself
// is managed in Requests.
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Briefcase, CheckCircle2, ChevronRight, Clock, Eye, House as Home, MapPin, Send, Star } from 'lucide-react-native'
import { Section, StackScreenShell } from '../../components/builder/BuilderUi'
import { PanelState } from '../../components/DashboardShell'
import { fetchSupplierClients } from '../../api/profiles'
import { fetchIncomingRequests } from '../../api/requests'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useLanguage } from '../../i18n/LanguageContext'
import { SERVICE_OPTION_KEYS, optionLabel } from '../../i18n/optionKeys'
import { userAvatarSource } from '../../utils/avatars'
import { constructionTypeLabel } from '../../utils/roleLabels'
import { userCountry } from '../../utils/countryConfig'
import { formatDate } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { CountTabs } from './orders/orderParts'
import { Avatar, ClientProfileSheet, RequestStatusLine, clientRequestKey, useClientRequestActions } from './clients/clientParts'

export default function SupplierFindClientsScreen({ navigation }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const [clients, setClients] = useState([])
  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState('builders')
  const [profile, setProfile] = useState(null)

  const load = useCallback(async () => {
    const [clientResult, requestResult] = await Promise.allSettled([fetchSupplierClients(userCountry(user)), fetchIncomingRequests()])
    if (clientResult.status === 'fulfilled') setClients(Array.isArray(clientResult.value) ? clientResult.value : [])
    if (requestResult.status === 'fulfilled') setRequests(Array.isArray(requestResult.value) ? requestResult.value : [])
    setStatus(clientResult.status === 'fulfilled' ? 'ready' : (current) => (current === 'ready' ? 'ready' : 'error'))
  }, [user])
  useFocusEffect(useCallback(() => { load() }, [load]))
  useLiveRefresh(load)
  const actions = useClientRequestActions(load)

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Clients already linked to this supplier by a request stop being prospects.
  const discoverable = useMemo(() => {
    const linked = new Set()
    requests.forEach((request) => {
      if (request.status === 'withdrawn') return
      const other = request.is_sender ? request.receiver_id : request.sender_id
      if (['SUPPLIER_TO_OWNER', 'OWNER_TO_SUPPLIER'].includes(request.request_type)) linked.add(`OWNER:${other}`)
      else if (['SUPPLIER_TO_CONTRACTOR', 'CONTRACTOR_TO_SUPPLIER'].includes(request.request_type)) linked.add(`CONTRACTOR:${other}`)
    })
    return clients.filter((client) => !linked.has(`${client.type}:${client.user_id}`))
  }, [clients, requests])

  const incoming = (type) => requests.filter((request) => !request.is_sender && request.status === 'pending' && request.request_type === type)
  const ownerRequests = incoming('OWNER_TO_SUPPLIER')
  const builderRequests = incoming('CONTRACTOR_TO_SUPPLIER')
  const ownerClients = discoverable.filter((client) => client.type === 'OWNER')
  const builderClients = discoverable.filter((client) => client.type === 'CONTRACTOR')
  const tabs = [
    { id: 'houseowners', label: t('role.owner'), count: ownerRequests.length + ownerClients.length },
    { id: 'builders', label: t('role.builder'), count: builderRequests.length + builderClients.length },
  ]
  const shownRequests = tab === 'houseowners' ? ownerRequests : builderRequests
  const shownClients = tab === 'houseowners' ? ownerClients : builderClients

  const renderRequest = (request) => {
    const isOwner = request.sender_role === 'OWNER'
    const busy = actions.busyId === request.id
    return (
      <View key={`req-${request.id}`} style={styles.card}>
        <View style={styles.row}>
          <Avatar source={userAvatarSource(request)} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kind}>{isOwner ? t('role.owner') : t('role.builder')}</Text>
            <Text style={styles.name} numberOfLines={1}>{request.sender_name ? td(request.sender_name) : t('dash.supplier.nearbyClient')}</Text>
            {request.project_title ? <Text style={styles.sub} numberOfLines={1}>{td(request.project_title)}</Text> : null}
          </View>
          <View style={styles.pin}>
            <MapPin size={12} color="#059669" />
            <Text style={styles.pinText}>{request.project_pincode || request.sender_pincode || '—'}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(request.created_at, '')}</Text>
          <RequestStatusLine request={request} />
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => actions.accept(request.id)} disabled={busy} style={[styles.button, styles.primary, busy ? styles.dim : null]}>
            <CheckCircle2 size={14} color="#ffffff" />
            <Text style={[styles.buttonText, { color: '#ffffff' }]}>{t('ce.accept')}</Text>
          </Pressable>
          <Pressable onPress={() => actions.reject(request.id)} disabled={busy} style={[styles.button, styles.outline]}>
            <Text style={[styles.buttonText, styles.outlineText]}>{t('ce.reject')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const renderClient = (client) => {
    const key = clientRequestKey(client)
    const sent = Boolean(actions.sentKeys[key])
    const sending = actions.sendingId === client.user_id
    const isOwner = client.type === 'OWNER'
    // Who the client is comes first; what they work on sits underneath.
    const title = td(client.name || client.company_name || client.project_title) || t('dash.supplier.nearbyClient')
    const ownerLine = client.project_title ? `${t('dash.common.project')}: ${td(client.project_title)}` : t('dash.supplier.noProjectDetails')
    const company = client.company_name && client.company_name !== client.name ? td(client.company_name) : ''
    const services = !isOwner && client.services_offered?.length
      ? client.services_offered.map((service) => optionLabel(t, SERVICE_OPTION_KEYS, service)).join(', ')
      : ''
    const completed = client.completed_project_details?.length
      ? client.completed_project_details.slice(0, 2).map((project) => (project.title ? td(project.title) : t('dash.common.project'))).join(' · ')
      : ''
    return (
      <Pressable key={key} onPress={() => setProfile(client)} style={styles.card}>
        <View style={styles.row}>
          <Avatar source={userAvatarSource(client, client.type)} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{title}</Text>
            {!isOwner && company ? <Text style={styles.sub} numberOfLines={1}>{company}</Text> : null}
            {isOwner && client.construction_type ? (
              <View style={styles.typeChip}>
                <Home size={12} color="#d97706" />
                <Text style={styles.typeText}>{constructionTypeLabel(client.construction_type, t)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.pin}>
            <MapPin size={12} color="#059669" />
            <Text style={styles.pinText}>{client.pincode || '—'}</Text>
          </View>
          <ChevronRight size={16} color={COLORS.slate[400]} />
        </View>

        {isOwner ? <Text style={[styles.sub, { marginTop: 10 }]}>{ownerLine}</Text> : (
          <View style={styles.stats}>
            <View style={styles.stat}><Clock size={12} color={COLORS.slate[500]} /><Text style={styles.statText}>{`${client.experience_years || 0} ${t('dash.supplier.yrs')}`}</Text></View>
            <View style={styles.stat}><Briefcase size={12} color={COLORS.slate[500]} /><Text style={styles.statText}>{`${client.completed_projects || 0} ${t('dash.supplier.projects')}`}</Text></View>
            <View style={[styles.stat, styles.statStar]}><Star size={12} color="#f59e0b" fill="#fbbf24" /><Text style={styles.statText}>{Number(client.rating || 0).toFixed(1)}</Text></View>
          </View>
        )}
        {services ? <Text style={styles.services} numberOfLines={2}>{services}</Text> : null}
        {completed ? <Text style={styles.completed} numberOfLines={1}>{`${t('dash.supplier.completed')}: ${completed}`}</Text> : null}

        <View style={styles.actions}>
          {sent ? (
            <View style={[styles.button, styles.sent, { flex: 1.6 }]}>
              <CheckCircle2 size={14} color="#047857" />
              <Text style={[styles.buttonText, styles.sentText]}>{t('dash.common.requestSent')}</Text>
            </View>
          ) : (
            <Pressable onPress={() => actions.send(client)} disabled={sending} style={[styles.button, styles.dark, { flex: 1.6 }, sending ? styles.dim : null]}>
              <Send size={14} color="#ffffff" />
              <Text style={[styles.buttonText, { color: '#ffffff' }]}>{sending ? t('dash.common.sending') : t('dash.common.sendRequest')}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setProfile(client)} style={[styles.button, styles.outline]}>
            <Eye size={14} color={COLORS.slate[600]} />
            <Text style={[styles.buttonText, styles.outlineText]}>{t('dash.common.viewProfile')}</Text>
          </Pressable>
        </View>
      </Pressable>
    )
  }

  return (
    <StackScreenShell title={t('ui.findClients')} subtitle={t('dash.supplier.nearbyClients')} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={onRefresh}>
      <Section style={{ gap: 12 }}>
        <CountTabs tabs={tabs} active={tab} onChange={setTab} />
        {status === 'loading' ? <PanelState loading skeleton="cards" /> : status === 'error' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Clients could not be loaded.</Text>
            <Pressable onPress={load} style={{ marginTop: 6 }}><Text style={styles.link}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
          </View>
        ) : shownRequests.length === 0 && shownClients.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('dash.supplier.noClients')}</Text>
            <Text style={styles.emptyText}>{t('dash.supplier.noClientsSub')}</Text>
          </View>
        ) : (
          <>
            {shownRequests.length ? <Text style={styles.label}>{t('ce.pendingJoinRequests')}</Text> : null}
            {shownRequests.map(renderRequest)}
            {shownClients.length ? <Text style={styles.label}>{t('dash.supplier.nearbyClients')}</Text> : null}
            {shownClients.map(renderClient)}
          </>
        )}
      </Section>

      {profile ? (
        <ClientProfileSheet
          client={profile}
          requestSent={Boolean(actions.sentKeys[clientRequestKey(profile)])}
          sending={actions.sendingId === profile.user_id}
          onClose={() => setProfile(null)}
          onSendRequest={actions.send}
        />
      ) : null}
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  label: { marginTop: 4, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, textTransform: 'uppercase', color: c.textFaint },
  card: { borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kind: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase', color: c.brandText },
  name: { fontSize: 14.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  sub: { marginTop: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, backgroundColor: c.emeraldSoft, paddingHorizontal: 8, paddingVertical: 4 },
  pinText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text },
  typeChip: { marginTop: 4, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, borderRadius: 999, backgroundColor: c.amberSoft, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text },
  stats: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: c.subtle, paddingHorizontal: 9, paddingVertical: 4 },
  statStar: { backgroundColor: c.amberSoft },
  statText: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text },
  services: { marginTop: 8, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', color: c.textMuted },
  completed: { marginTop: 3, fontSize: 11, fontFamily: 'Inter_400Regular', color: c.textFaint },
  footer: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 9 },
  date: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textFaint },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  button: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 8 },
  buttonText: { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  primary: { backgroundColor: '#236645' },
  dark: { backgroundColor: '#134127' },
  outline: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  outlineText: { color: c.textSecondary },
  sent: { borderWidth: 1, borderColor: c.emeraldBorderSoft, backgroundColor: c.emeraldSoft },
  sentText: { color: c.emeraldText },
  dim: { opacity: 0.6 },
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 20, paddingVertical: 30 },
  emptyTitle: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyText: { textAlign: 'center', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  link: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
}))
