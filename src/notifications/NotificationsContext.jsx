// What the web keeps in NotificationBell + the dashboards' badge counts, in one
// place for the whole signed-in app:
//   - the notification list (chat messages excluded, as the web's bell does)
//     and its unread count, for the header bell;
//   - unread counts per section (requests, builders, suppliers, escrow,
//     projects/estimates), for the tab badges;
//   - unread chat messages, from the conversation list;
//   - markSectionRead(section): the modules a section clears when opened
//     (the web's SECTION_NOTIFICATION_MODULES).
// It also keeps the live-events socket open while signed in, and reloads on a
// live hint, when the app returns to the foreground, and once a minute.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { fetchNotifications, markModuleNotificationsRead, markNotificationsRead } from '../api/notifications'
import { fetchConversations } from '../api/messages'
import { wakeLiveEvents } from '../api/liveEvents'
import { useLiveEventsConnection, useLiveRefresh } from '../hooks/useLiveRefresh'

const FALLBACK_POLL_MS = 60000

// notification.module -> the section whose badge counts it.
const MODULE_SECTION = {
  request: 'requests',
  project: 'projects',
  contractor: 'builders',
  supplier: 'suppliers',
  estimate: 'estimates',
  escrow: 'escrow',
  general: 'profile',
}

// The modules each destination marks read on arrival.
export const SECTION_NOTIFICATION_MODULES = {
  projects: ['project', 'estimate'],
  messages: ['message', 'request', 'contractor', 'supplier'],
  profile: ['general'],
  requests: ['request'],
  builders: ['contractor'],
  suppliers: ['supplier'],
  escrow: ['escrow'],
}

const empty = {
  notifications: [],
  unreadCount: 0,
  badgeCounts: {},
  unreadMessages: 0,
  reload: () => {},
  markAllRead: async () => {},
  markSectionRead: () => {},
}

const NotificationsContext = createContext(empty)

export function NotificationsProvider({ signedIn, children }) {
  const [rawList, setRawList] = useState([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const loadingRef = useRef(false)

  useLiveEventsConnection(signedIn)

  const reload = useCallback(async () => {
    if (!signedIn || loadingRef.current) return
    loadingRef.current = true
    try {
      const [list, conversations] = await Promise.all([
        fetchNotifications().catch(() => null),
        fetchConversations().catch(() => null),
      ])
      if (Array.isArray(list)) setRawList(list)
      const rows = Array.isArray(conversations) ? conversations : conversations?.conversations
      if (Array.isArray(rows)) {
        setUnreadMessages(rows.reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0))
      }
    } finally {
      loadingRef.current = false
    }
  }, [signedIn])

  useEffect(() => {
    if (!signedIn) {
      setRawList([])
      setUnreadMessages(0)
      return undefined
    }
    reload()
    const timer = setInterval(reload, FALLBACK_POLL_MS)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        wakeLiveEvents()
        reload()
      }
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [signedIn, reload])

  useLiveRefresh(reload)

  const markAllRead = useCallback(async () => {
    await markNotificationsRead().catch(() => {})
    await reload()
  }, [reload])

  const markSectionRead = useCallback((section) => {
    const modules = SECTION_NOTIFICATION_MODULES[section] || []
    const unread = new Set(rawList.filter((item) => !item.is_read).map((item) => item.module))
    const toClear = modules.filter((moduleName) => unread.has(moduleName))
    if (!toClear.length) return
    Promise.all(toClear.map((moduleName) => markModuleNotificationsRead(moduleName).catch(() => {}))).then(reload)
  }, [rawList, reload])

  const value = useMemo(() => {
    const notifications = rawList.filter((item) => item.module !== 'message')
    const badgeCounts = {}
    rawList.forEach((item) => {
      if (item.is_read) return
      const section = MODULE_SECTION[item.module]
      if (section) badgeCounts[section] = (badgeCounts[section] || 0) + 1
    })
    return {
      notifications,
      unreadCount: notifications.filter((item) => !item.is_read).length,
      badgeCounts,
      unreadMessages,
      reload,
      markAllRead,
      markSectionRead,
    }
  }, [rawList, unreadMessages, reload, markAllRead, markSectionRead])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
