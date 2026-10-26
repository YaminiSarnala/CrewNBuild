// Port of the web pages/owner/OwnerSiteEngineerSection.jsx: hiring a Site
// Engineer for a self-construction project, the same way a builder is hired --
// send a request (OWNER_TO_ENGINEER), wait for it to be accepted, then choose
// one of the engineers who accepted. Nothing here is a second engineer system:
// /engineers/find, /project-requests/send and the existing assignment.
// Once one is assigned, the section shows them and the project's site record.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { HardHat, MapPin, Send, Star } from 'lucide-react-native'
import { Panel, PanelState } from '../../components/DashboardShell'
import { FormNotice } from '../../components/form'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { useProfileGate } from '../../hooks/useProfileGate'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { assignEngineerFromRequest, fetchNearbyEngineers, fetchProjectEngineer } from '../../api/engineers'
import { fetchIncomingRequests, sendProjectRequest } from '../../api/requests'
import { userAvatarSource } from '../../utils/avatars'
import { COLORS } from '../../theme/tokens'
import { apiDetail } from './ownerHelpers'
import SitePhotoCalendar from './SitePhotoCalendar'
import { createStyles } from '../../theme/createStyles'

// The request type and engineer category the backend enforces.
const OWNER_TO_ENGINEER = 'OWNER_TO_ENGINEER'
const SITE_ENGINEER_CATEGORY = 'Site Engineer'

// Port of ENGINEER_CATEGORY_LABEL_KEYS (web pages/auth/profileConstants.js).
const ENGINEER_CATEGORY_LABEL_KEYS = {
  'Site Engineer': 'role.engineer',
  'Soil Engineer': 'ui.profile.engCat.soilEngineer',
  'Survey Engineer': 'ui.profile.engCat.surveyEngineer',
  Architecture: 'ui.profile.engCat.architecture',
  'Structural Engineer': 'ui.profile.engCat.structuralEngineer',
  'Civil Engineer': 'ui.profile.engCat.civilEngineer',
  'Electrical Engineer': 'ui.profile.engCat.electricalEngineer',
  Plumbing: 'opt.category.plumbing',
  'Mechanical Engineer': 'ui.profile.engCat.mechanicalEngineer',
  HVAC: 'ui.profile.engCat.hvac',
  'Quantity Surveyor': 'ui.profile.engCat.quantitySurveyor',
  Safety: 'opt.category.safety',
  'Construction Safety': 'ui.profile.engCat.constructionSafety',
  'Finishing / Painter': 'ui.profile.engCat.finishingPainter',
}

function PersonCard({ person, role, title, subtitle, pills = [], width, children }) {
  return (
    <View style={[styles.view, { width }]}>
      <View style={[styles.view2, { gap: 10 }]}>
        <Image source={userAvatarSource(person, role)} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
        <View style={styles.view3}>
          <Text style={[styles.text, { fontSize: 14.5 }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.text2, { fontSize: 11.5 }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {pills.length ? (
        <View style={[styles.view4, { gap: 6 }]}>
          {pills.map((pill) => (
            <View
              key={pill.key}
              style={[styles.view5, pill.positive ? styles.view6 : styles.view7, { gap: 4 }]}
            >
              {pill.icon ? <pill.icon size={11} color={pill.positive ? '#047857' : COLORS.slate[500]} /> : null}
              {pill.dot ? <View style={styles.view8} /> : null}
              <Text style={[styles.text3, pill.positive ? styles.text4 : styles.text5, { fontSize: 10.5 }]}>{pill.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {children}
    </View>
  )
}

function WideButton({ label, onPress, disabled, icon: Icon }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.pressable, disabled ? styles.pressable2 : null, { gap: 6 }]}
    >
      <Text style={[styles.text6, { fontSize: 12.5 }]}>{label}</Text>
      {Icon ? <Icon size={13} color="#ffffff" /> : null}
    </Pressable>
  )
}

export default function OwnerSiteEngineerSection({ project }) {
  const { t, td } = useLanguage()
  const { columns } = useResponsive()
  const { requireCompleteProfile } = useProfileGate()
  const [engineers, setEngineers] = useState([])
  const [requests, setRequests] = useState([])
  const [assigned, setAssigned] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState({ text: '', tone: 'info' })
  const [loading, setLoading] = useState(true)
  const projectId = project?.id || null

  const specializationText = (value) => {
    if (!value) return t('role.engineer')
    const key = ENGINEER_CATEGORY_LABEL_KEYS[value]
    return key ? t(key) : td(value)
  }

  const refresh = useCallback(async () => {
    if (!projectId) return
    const [engineerList, requestList, current] = await Promise.all([
      fetchNearbyEngineers(project.pincode, project.project_country, projectId, SITE_ENGINEER_CATEGORY).catch(() => []),
      fetchIncomingRequests().catch(() => []),
      fetchProjectEngineer(projectId).catch(() => ({ engineer: null })),
    ])
    setEngineers(Array.isArray(engineerList) ? engineerList : [])
    setRequests(Array.isArray(requestList) ? requestList : [])
    setAssigned(current?.engineer || null)
    setLoading(false)
  }, [projectId, project?.pincode, project?.project_country])

  useEffect(() => { refresh() }, [refresh])
  // An engineer accepting or declining this owner's request shows at once.
  useLiveRefresh(refresh)

  // This project's own engineer requests.
  const myRequests = useMemo(() => requests.filter(
    (item) => item.request_type === OWNER_TO_ENGINEER && String(item.project_id) === String(projectId) && item.is_sender,
  ), [requests, projectId])
  const statusFor = (engineerId) => myRequests.find((item) => String(item.receiver_id) === String(engineerId))?.status || 'none'
  const acceptedRequests = myRequests.filter((item) => item.status === 'accepted')
  // An engineer who accepted is shown above with the decision to make.
  const browseList = engineers.filter((engineer) => statusFor(engineer.user_id) !== 'accepted')

  // Asking a Site Engineer is a request like asking a builder: it needs a complete profile.
  const send = async (engineer) => {
    if (requireCompleteProfile(() => send(engineer))) return
    setMessage({ text: '', tone: 'info' })
    setBusyId(engineer.user_id)
    try {
      await sendProjectRequest({ receiver_id: engineer.user_id, project_id: projectId, request_type: OWNER_TO_ENGINEER })
      setMessage({ text: t('dash.supplier.msg.sentTo', { name: td(engineer.name) }), tone: 'success' })
      await refresh()
    } catch (error) {
      setMessage({ text: apiDetail(error, t('ui.owner.sendRequestFailed')), tone: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const assign = async (request) => {
    setMessage({ text: '', tone: 'info' })
    setBusyId(request.id)
    try {
      await assignEngineerFromRequest(request.id)
      setMessage({ text: t('ui.owner.siteEngineerAssigned'), tone: 'success' })
      await refresh()
    } catch (error) {
      setMessage({ text: apiDetail(error, t('ui.owner.assignEngineerFailed')), tone: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const cardWidth = columns > 1 ? `${(100 - (columns - 1) * 2) / columns}%` : '100%'

  if (loading) return <Panel title={t('role.engineer')}><PanelState loading>{null}</PanelState></Panel>

  return (
    <View>
      <FormNotice message={message.text} tone={message.tone} style={{ marginBottom: 12 }} />

      {assigned ? (
        <>
          <PersonCard
            person={assigned}
            role="ENGINEER"
            title={td(assigned.name)}
            subtitle={specializationText(assigned.specialization)}
            pills={[
              { key: 'pincode', text: `${t('dash.common.pincode')} ${assigned.pincode || '—'}`, icon: MapPin },
              { key: 'assigned', text: t('ui.owner.assignedToThisProject'), positive: true, dot: true },
            ]}
          />
          {/* The site record -- the same one the Site Activity tab shows. */}
          <SitePhotoCalendar project={project} />
        </>
      ) : (
        <>
          {/* Accepted requests first: this is the choice the owner has to make. */}
          {acceptedRequests.length ? (
            <Panel title={t('ui.owner.acceptedChooseOne', { count: acceptedRequests.length })}>
              <View style={styles.view9}>
                {acceptedRequests.map((item) => (
                  <PersonCard
                    key={item.id}
                    person={item}
                    role="ENGINEER"
                    width={cardWidth}
                    title={td(item.receiver_name || item.sender_name)}
                    subtitle={t('role.engineer')}
                    pills={[{ key: 'accepted', text: t('dash.common.accepted'), positive: true, dot: true }]}
                  >
                    <WideButton
                      label={busyId === item.id ? t('ui.owner.assigning') : t('ui.owner.assignThisProject')}
                      onPress={() => assign(item)}
                      disabled={busyId === item.id}
                    />
                  </PersonCard>
                ))}
              </View>
            </Panel>
          ) : null}

          <Panel title={t('ui.owner.findSiteEngineer')}>
            <Text style={[styles.text7, { fontSize: 12.5 }]}>
              {t('ui.owner.siteEngineersNear', { place: project.pincode || t('ui.owner.yourProject') })}
            </Text>
            {browseList.length ? (
              <View style={styles.view9}>
                {browseList.map((engineer) => {
                  const status = statusFor(engineer.user_id)
                  return (
                    <PersonCard
                      key={engineer.user_id}
                      person={engineer}
                      role="ENGINEER"
                      width={cardWidth}
                      title={td(engineer.name)}
                      subtitle={specializationText(engineer.specialization)}
                      pills={[
                        { key: 'pincode', text: `${t('dash.common.pincode')} ${engineer.pincode || '—'}`, icon: MapPin },
                        { key: 'rating', text: String(engineer.rating || t('dash.common.new')), icon: Star },
                      ]}
                    >
                      {status === 'pending' ? (
                        <View style={styles.view10}>
                          <Text style={[styles.text8, { fontSize: 12.5 }]}>{t('dash.common.requestPending')}</Text>
                        </View>
                      ) : (
                        <WideButton
                          label={busyId === engineer.user_id ? t('dash.common.sending') : t('dash.common.sendRequest')}
                          icon={Send}
                          onPress={() => send(engineer)}
                          disabled={busyId === engineer.user_id}
                        />
                      )}
                    </PersonCard>
                  )
                })}
              </View>
            ) : (
              <View style={styles.view11}>
                <HardHat size={24} color={COLORS.slate[300]} />
                <Text style={[styles.text9, { fontSize: 13.5 }]}>
                  {engineers.length ? t('ui.owner.everyoneReplied') : t('ui.owner.noEngineersNearby')}
                </Text>
                <Text style={[styles.text10, { fontSize: 12 }]}>
                  {engineers.length ? t('ui.owner.chooseAcceptedAbove') : t('ui.owner.noEngineersNearbySub')}
                </Text>
              </View>
            )}
          </Panel>
        </>
      )}
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 10.5, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  view2: { flexDirection: 'row', alignItems: 'center' },
  view3: { flex: 1 },
  text: { fontFamily: 'Inter_700Bold', color: c.text },
  text2: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view4: { marginTop: 8.75, flexDirection: 'row', flexWrap: 'wrap' },
  view5: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  view6: { backgroundColor: c.emeraldSoft },
  view7: { backgroundColor: c.muted },
  view8: { height: 5.25, width: 5.25, borderRadius: 9999, backgroundColor: '#10b981' },
  text3: { fontFamily: 'Inter_700Bold' },
  text4: { color: c.emeraldText },
  text5: { color: c.textSecondary },
  pressable: { marginTop: 8.75, height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#1a5038' },
  pressable2: { opacity: 0.6 },
  text6: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view9: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  text7: { marginTop: -3.5, marginBottom: 10.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view10: { marginTop: 8.75, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.amberBorderSoft, backgroundColor: c.amberSoft },
  text8: { fontFamily: 'Inter_700Bold', color: c.amberText },
  view11: { alignItems: 'center', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, padding: 17.5 },
  text9: { marginTop: 7, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
  text10: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
}))
