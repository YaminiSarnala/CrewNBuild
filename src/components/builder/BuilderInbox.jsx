// The Builder's badges and "New request" alert — port of what web
// ContractorDashboard + hooks/useRequestInbox.js + utils/requestInbox.js do for
// the sidebar:
//
//   Requests     pending owner / supplier requests sent TO the builder that the
//                builder has not opened yet (seen set kept per user, as the web
//                keeps it in localStorage; here AsyncStorage).
//   More         Find Clients' unseen nearby leads (web hasDot + count), else the
//                unread notifications the web files under Find Clients, plus
//                unread messages.
//   Projects / My Partners   unread notifications by module, as the web maps them.
//
// A request that arrives while the app is open shows a banner (web
// NewRequestToast) and a short vibration in place of the web's sound.
//
// Data comes from the same endpoints the web polls: GET /project-requests/incoming,
// /contractors/find-clients, /notifications, /messages/conversations — re-read
// every 15 s, on every live hint (/events/ws) and when the app returns to the
// foreground.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Pressable, Text, Vibration, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { BellRing, X } from 'lucide-react-native'
import { fetchIncomingRequests } from '../../api/requests'
import { fetchNearbyProjects } from '../../api/projects'
import { fetchNotifications } from '../../api/notifications'
import { fetchConversations } from '../../api/messages'
import { useLiveEventsConnection, useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useLanguage } from '../../i18n/LanguageContext'
import { asList } from '../../utils/builderHelpers'
import { createStyles } from '../../theme/createStyles'

const POLL_MS = 15000
const TOAST_MS = 9000
const SEEN_LIMIT = 1000

// web contractorHelpers.clientIdentity
export const clientIdentity = (client) => [
  client.client_type || 'PROJECT',
  client.owner_id || client.user_id || 'owner',
  client.project_id || client.id || 'profile',
].join(':')

// web utils/requestInbox.projectRequestItems, for the Requests board
function requestKeys(rows) {
  return rows
    .filter((row) => row && row.is_receiver && !row.is_sender && String(row.status || '').toLowerCase() === 'pending')
    .filter((row) => ['OWNER_TO_CONTRACTOR', 'SUPPLIER_TO_CONTRACTOR'].includes(row.request_type))
    .map((row) => `request:${row.id}`)
}

// web ContractorDashboard.refreshNotificationBadgeCounts
const MODULE_SECTION = {
  request: 'requestsBoard',
  project: 'projects',
  contractor: 'findClients',
  supplier: 'findClients',
  estimate: 'projects',
  escrow: 'projects',
  engineers: 'engineers',
  general: 'profile',
}

async function readSet(key) {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(key)) || '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

async function writeSet(key, set) {
  const list = [...set].slice(-SEEN_LIMIT)
  try { await AsyncStorage.setItem(key, JSON.stringify(list)) } catch { /* the badge just stays */ }
  return new Set(list)
}

const BuilderInboxContext = createContext(null)

const EMPTY = {
  requests: [],
  requestsLoaded: false,
  unreadRequests: 0,
  unseenClients: 0,
  notificationCounts: {},
  unreadMessages: 0,
  markRequestsSeen: () => {},
  markClientsSeen: () => {},
  reload: () => {},
}

/** Badges and alert state for the Builder; safe to call outside the provider. */
export function useBuilderInbox() {
  return useContext(BuilderInboxContext) || EMPTY
}

export function BuilderInboxProvider({ children }) {
  const user = useSelector((state) => state.auth.user)
  const userId = user?.id
  const country = user?.country_of_residence || 'India'
  const requestSeenKey = `octabuild_seen_requests:${userId || 'anonymous'}`
  const clientSeenKey = `gharbano_seen_contractor_clients_v2_${userId ? `${userId}:${user?.email || user?.name || 'contractor'}` : 'guest'}_${user?.pincode || 'all'}`

  const [requests, setRequests] = useState([])
  const [requestsLoaded, setRequestsLoaded] = useState(false)
  const [clientKeys, setClientKeys] = useState([])
  const [seenRequests, setSeenRequests] = useState(new Set())
  const [seenClients, setSeenClients] = useState(new Set())
  const [notificationCounts, setNotificationCounts] = useState({})
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [toast, setToast] = useState({ count: 0, open: false })
  const known = useRef(null)
  const toastTimer = useRef(null)
  const loadGeneration = useRef(0)

  useLiveEventsConnection()

  useEffect(() => { readSet(requestSeenKey).then(setSeenRequests) }, [requestSeenKey])
  useEffect(() => { readSet(clientSeenKey).then(setSeenClients) }, [clientSeenKey])

  const reload = useCallback(() => {
    if (!userId) return
    const generation = ++loadGeneration.current
    const isLatest = () => generation === loadGeneration.current
    fetchIncomingRequests()
      .then((rows) => { if (isLatest()) { setRequests(asList(rows, 'items', 'requests')); setRequestsLoaded(true) } })
      .catch(() => {})
    fetchNearbyProjects(country)
      .then((rows) => { if (isLatest()) setClientKeys(asList(rows, 'projects', 'items').map(clientIdentity)) })
      .catch(() => {})
    fetchNotifications()
      .then((rows) => {
        if (!isLatest()) return
        const counts = {}
        asList(rows, 'items', 'notifications').forEach((notification) => {
          if (notification.is_read) return
          const section = MODULE_SECTION[notification.module]
          if (section) counts[section] = (counts[section] || 0) + 1
        })
        setNotificationCounts(counts)
      })
      .catch(() => {})
    fetchConversations()
      .then((rows) => { if (isLatest()) setUnreadMessages(asList(rows, 'items', 'conversations').reduce((total, row) => total + Number(row.unread_count || 0), 0)) })
      .catch(() => {})
  }, [userId, country])

  useEffect(() => {
    reload()
    const timer = setInterval(() => { if (AppState.currentState === 'active') reload() }, POLL_MS)
    return () => clearInterval(timer)
  }, [reload])
  useLiveRefresh(reload)

  const pendingKeys = useMemo(() => requestKeys(requests), [requests])
  const unreadRequests = pendingKeys.filter((key) => !seenRequests.has(key)).length
  const unseenClients = clientKeys.filter((key) => !seenClients.has(key)).length

  // Arrivals during this session (web createArrivalTracker): the first load only
  // records what is there; later, each key not met before is announced once.
  const signature = pendingKeys.join('|')
  useEffect(() => {
    if (!requestsLoaded) return
    if (known.current === null) {
      known.current = new Set(pendingKeys)
      return
    }
    const arrived = pendingKeys.filter((key) => !known.current.has(key) && !seenRequests.has(key))
    pendingKeys.forEach((key) => known.current.add(key))
    if (!arrived.length) return
    Vibration.vibrate(250)
    setToast((current) => ({ count: (current.open ? current.count : 0) + arrived.length, open: true }))
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast({ count: 0, open: false }), TOAST_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, requestsLoaded])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const markRequestsSeen = useCallback(async (keys) => {
    const list = keys || pendingKeys
    if (!list.length) return
    const current = await readSet(requestSeenKey)
    let changed = false
    list.forEach((key) => { if (!current.has(key)) { current.add(key); changed = true } })
    if (changed) setSeenRequests(await writeSet(requestSeenKey, current))
    setToast({ count: 0, open: false })
  }, [pendingKeys, requestSeenKey])

  const markClientsSeen = useCallback(async () => {
    if (!userId || !clientKeys.length) return
    // The web replaces the stored list with the leads on screen.
    setSeenClients(await writeSet(clientSeenKey, new Set(clientKeys)))
  }, [clientKeys, clientSeenKey, userId])

  const value = useMemo(() => ({
    requests,
    requestsLoaded,
    unreadRequests,
    unseenClients,
    notificationCounts,
    unreadMessages,
    markRequestsSeen,
    markClientsSeen,
    reload,
  }), [requests, requestsLoaded, unreadRequests, unseenClients, notificationCounts, unreadMessages, markRequestsSeen, markClientsSeen, reload])

  return (
    <BuilderInboxContext.Provider value={value}>
      {children}
      <NewRequestBanner toast={toast} onDismiss={() => setToast({ count: 0, open: false })} />
    </BuilderInboxContext.Provider>
  )
}

function NewRequestBanner({ toast, onDismiss }) {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { t } = useLanguage()
  if (!toast.open || !toast.count) return null
  const title = t(toast.count === 1 ? 'ui.requestInbox.newRequestsReceivedOne' : 'ui.requestInbox.newRequestsReceivedMany', { count: toast.count })
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12 }}>
      <View style={[styles.view, { elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }]}>
        <BellRing size={18} color="#fff" />
        <View style={styles.view2}>
          <Text style={styles.text}>{title}</Text>
          <Pressable
            onPress={() => {
              onDismiss()
              navigation.navigate('ContractorHome', { screen: 'ContractorRequestsTab' })
            }}
          >
            <Text style={styles.text2}>{t('ui.requestInbox.viewRequests')}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onDismiss} accessibilityLabel={t('ui.requestInbox.dismiss')} style={styles.pressable}>
          <X size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderRadius: 16, backgroundColor: '#134127', paddingHorizontal: 14, paddingVertical: 10.5 },
  view2: { flex: 1 },
  text: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  text2: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#c3dccd', textDecorationLine: 'underline' },
  pressable: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center' },
}))
