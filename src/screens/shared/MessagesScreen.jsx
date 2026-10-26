// Port of the web MessageThread.jsx: the conversation list with unread badges,
// then a thread on the chat WebSocket (/messages/ws/{id}?token=):
//   connected  the latest messages (backlog), then we send {event:'read'}
//   message    a new message (ours or theirs); theirs is marked read at once
//   typing     the other side is typing
//   read       the other side has read ours -> ✓✓
// Sending goes over the socket when it is open, otherwise through REST. The
// socket pings every 25 s and reconnects 2 s after a drop; while it is not
// open the thread re-reads every 5 s over REST, so chat still works without it.
// The list refreshes every 15 s and on a live hint.
// Request / assignment messages (JSON bodies) and workflow events ("COUNTER-OFFER:
// ...") are drawn as the web's small cards (messageCards.jsx): what happened,
// the project, one amount, the status and View Request. Accepting or quoting
// from inside the chat is not ported; that is done in the project's Requests.
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Linking, BackHandler } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { ArrowLeft, ArrowRight, Check, CheckCheck, FileText, MessageCircle, Send } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { formatMoney } from '../../utils/countryConfig'
import { fetchConversations, fetchConversationMessages, sendConversationMessage } from '../../api/messages'
import { getCachedAuth, imageSource, imageUrl, websocketUrl } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useNotifications } from '../../notifications/NotificationsContext'
import { userAvatarSource } from '../../utils/avatars'
import { formatTime } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const LIST_POLL_MS = 15000
const PING_MS = 25000
const RECONNECT_MS = 2000
// While the socket is not open (it may be unavailable), the thread re-reads over REST.
const FALLBACK_POLL_MS = 5000

const rowsOf = (data) => (Array.isArray(data) ? data : (data?.messages || data?.conversations || []))
// The API stores UTC without a zone; read it as UTC.
const timeOf = (value) => (value ? formatTime(/[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? value : `${value}Z`, '') : '')

const SENDER_ROLE_KEYS = { OWNER: 'role.owner', CONTRACTOR: 'role.contractor', SUPPLIER: 'role.supplier', ENGINEER: 'role.engineer' }
const ACTION_STATE_KEYS = { accepted: 'ui.status.accepted', rejected: 'ui.status.rejected', withdrawn: 'ui.shared.statusWithdrawn' }
const OWNER_BUILDER_REQUEST_TYPES = ['OWNER_TO_CONTRACTOR', 'CONTRACTOR_TO_OWNER']
// Workflow events the server posts as plain text ("COUNTER-OFFER: ...").
const EVENT_KEYS = [
  ['QUOTATION', 'chat.event.quotation'],
  ['COUNTER-OFFER', 'chat.event.counterOffer'],
  ['OFFER ACCEPTED', 'chat.event.offerAccepted'],
  ['OFFER REJECTED', 'chat.event.offerRejected'],
  ['ASSIGNMENT DECLINED', 'chat.event.assignmentDeclined'],
  ['ASSIGNMENT CANCELLED', 'chat.event.assignmentCancelled'],
  ['PROJECT ASSIGNED', 'chat.event.projectAssigned'],
  ['REQUEST ACCEPTED', 'chat.event.requestAccepted'],
]

// A request / assignment message body is JSON with a `kind`.
function parseCardBody(body) {
  const text = String(body || '')
  if (!text.startsWith('{')) return null
  try {
    const details = JSON.parse(text)
    return ['PROJECT_REQUEST', 'PROJECT_ASSIGNMENT'].includes(details?.kind) ? details : null
  } catch {
    return null
  }
}

function parseChatEvent(body) {
  const value = String(body || '')
  const entry = EVENT_KEYS.find(([prefix]) => value.startsWith(`${prefix}:`))
  if (!entry) return null
  const text = value.slice(entry[0].length + 1).trim()
  const amountMatch = text.match(/₹\s?([\d,]+(?:\.\d+)?)/)
  return { key: entry[1], text, amount: amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null }
}

// What the conversation list shows for a card message instead of its JSON.
export function messagePreview(body, t, td) {
  const details = parseCardBody(body)
  if (details?.kind === 'PROJECT_ASSIGNMENT') return `${t('dash.msg.projectAssignment')} · ${td(details.project_title) || ''}`
  if (details?.kind === 'PROJECT_REQUEST') return details.project_title && details.project_title !== 'General request' ? `${t('dash.common.request')} · ${td(details.project_title)}` : t('dash.common.request')
  return td(body)
}

function EventCard({ label, title, amountLabel, amount, country, status, text, onView, t }) {
  return (
    <View style={styles.view}>
      <Text style={[styles.text, { fontSize: 10 }]}>{label}</Text>
      {title ? <Text style={[styles.text2, { fontSize: 14 }]}>{title}</Text> : null}
      {Number(amount) > 0 ? (
        <Text style={[styles.text3, { fontSize: 12 }]}>
          {`${amountLabel}: `}
          <Text style={[styles.text4, { fontSize: 13.5 }]}>{formatMoney(amount, country)}</Text>
        </Text>
      ) : null}
      {text ? <Text style={[styles.text3, { fontSize: 12, lineHeight: 17 }]}>{text}</Text> : null}
      {status ? (
        <View style={styles.view2}>
          <Text style={[styles.text5, { fontSize: 11 }]}>{status}</Text>
        </View>
      ) : null}
      {onView ? (
        <Pressable onPress={onView} style={[styles.pressable, { gap: 4 }]}>
          <Text style={[styles.text6, { fontSize: 12 }]}>{t('request.flow.viewRequest')}</Text>
          <ArrowRight size={12} color="#1a5038" />
        </Pressable>
      ) : null}
    </View>
  )
}

function CardMessage({ message, t, td }) {
  const navigation = useNavigation()
  const role = useSelector((state) => state.auth.user?.role)
  const details = parseCardBody(message.body)
  const event = details ? null : parseChatEvent(message.body)
  if (!details && !event) return null
  // An owner manages a builder request inside its project's Requests tab.
  const openRequest = (projectId, requestId, requestType) => (
    role === 'OWNER' && projectId && OWNER_BUILDER_REQUEST_TYPES.includes(requestType || 'CONTRACTOR_TO_OWNER')
      ? () => navigation.navigate('OwnerProject', { projectId, tab: 'requests', requestId })
      : null
  )
  if (event) {
    return <EventCard label={t(event.key)} amountLabel={t('dash.common.amount')} amount={event.amount} text={td(event.text)} t={t} />
  }
  if (details.kind === 'PROJECT_ASSIGNMENT') {
    const accepted = details.status === 'accepted'
    return (
      <EventCard
        label={t('dash.msg.projectAssignment')}
        title={td(details.project_title)}
        amountLabel={t('dash.common.quotation')}
        amount={details.quotation_amount || details.budget}
        country={details.project_country}
        status={accepted ? t('dash.msg.assignmentAccepted') : t('dash.msg.assignmentSentDot')}
        onView={openRequest(details.project_id, details.request_id, details.request_type)}
        t={t}
      />
    )
  }
  const quoted = Number(details.quotation_amount || 0) > 0
  const roleKey = SENDER_ROLE_KEYS[details.sender_role]
  return (
    <EventCard
      label={roleKey ? t('dash.msg.roleRequest', { role: t(roleKey).toLowerCase() }) : t('dash.common.request')}
      title={details.project_title && details.project_title !== 'General request' ? td(details.project_title) : t('dash.common.request')}
      amountLabel={quoted ? t('dash.common.quotation') : t('dash.common.budget')}
      amount={quoted ? details.quotation_amount : details.budget}
      country={details.project_country}
      status={ACTION_STATE_KEYS[details.status] ? t(ACTION_STATE_KEYS[details.status]) : ''}
      onView={openRequest(details.project_id, details.request_id, details.request_type)}
      t={t}
    />
  )
}

function Bubble({ message, mine, t, td }) {
  if (parseCardBody(message.body) || parseChatEvent(message.body)) return <CardMessage message={message} t={t} td={td} />
  const type = message.message_type || message.messageType
  return (
    <View
      style={[styles.view3, styles[mine ? 'self-end rounded-br-md bg-brand-700' : 'self-start rounded-bl-md border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]']]}
    >
      {message.attachment_url && type === 'IMAGE' ? (
        <Image source={imageSource(message.attachment_url)} style={{ width: 220, height: 160, borderRadius: 12, marginBottom: 6 }} contentFit="cover" />
      ) : null}
      {message.attachment_url && type !== 'IMAGE' ? (
        <Pressable onPress={() => Linking.openURL(imageUrl(message.attachment_url))} style={[styles.pressable2, { gap: 6 }]}>
          <FileText size={14} color={mine ? '#ffffff' : COLORS.graphite} />
          <Text style={[styles.text7, mine ? styles.text8 : styles.text9, { fontSize: 12.5 }]}>{t('dash.msg.openAttachment')}</Text>
        </Pressable>
      ) : null}
      {message.body ? (
        <Text style={[styles.text10, mine ? styles.text8 : styles.text9, { fontSize: 14, lineHeight: 19 }]}>
          {mine ? message.body : td(message.body)}
        </Text>
      ) : null}
      <View style={[styles.view4, { gap: 3 }]}>
        <Text style={[styles.text7, mine ? styles.text11 : styles.text12, { fontSize: 9.5 }]}>{timeOf(message.created_at)}</Text>
        {mine ? (message.read ? <CheckCheck size={12} color="#bfdbfe" /> : <Check size={12} color="rgba(255,255,255,0.6)" />) : null}
      </View>
    </View>
  )
}

function Thread({ conversation, onBack, onChanged }) {
  const { t, td } = useLanguage()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [typingNotice, setTypingNotice] = useState('')
  const listRef = useRef(null)
  const socketRef = useRef(null)
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  const append = useCallback((message) => {
    if (!message) return
    setMessages((items) => (items.some((item) => item.id === message.id) ? items : [...items, message]))
  }, [])

  const loadMessages = useCallback(async () => {
    try {
      setMessages(rowsOf(await fetchConversationMessages(conversation.id)))
    } catch {
      // the socket backlog fills the thread when it connects
    }
  }, [conversation.id])

  useEffect(() => {
    loadMessages()
    let closedByEffect = false
    let pingTimer = null
    let reconnectTimer = null
    let typingTimer = null

    const connect = () => {
      const token = getCachedAuth()?.accessToken
      if (!token) return
      let socket
      try {
        socket = new WebSocket(websocketUrl(`/messages/ws/${conversation.id}?token=${encodeURIComponent(token)}`))
      } catch {
        reconnectTimer = setTimeout(connect, RECONNECT_MS)
        return
      }
      socketRef.current = socket
      socket.onopen = () => {
        clearInterval(pingTimer)
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'ping' }))
        }, PING_MS)
      }
      socket.onmessage = (event) => {
        let payload
        try { payload = JSON.parse(event.data) } catch { return }
        if (payload.event === 'connected' && Array.isArray(payload.messages)) {
          setMessages(payload.messages)
          socket.send(JSON.stringify({ event: 'read' }))
          onChangedRef.current?.()
        }
        if (payload.event === 'message') {
          append(payload.message)
          if (!payload.message?.is_mine) socket.send(JSON.stringify({ event: 'read' }))
          onChangedRef.current?.()
        }
        if (payload.event === 'typing') {
          setTypingNotice(t('dash.msg.typing'))
          clearTimeout(typingTimer)
          typingTimer = setTimeout(() => setTypingNotice(''), 1800)
        }
        if (payload.event === 'read') {
          setMessages((items) => items.map((item) => (item.is_mine ? { ...item, read: true } : item)))
        }
      }
      socket.onclose = () => {
        clearInterval(pingTimer)
        if (socketRef.current === socket) socketRef.current = null
        if (!closedByEffect) reconnectTimer = setTimeout(connect, RECONNECT_MS)
      }
      socket.onerror = () => {}
    }

    connect()
    const fallbackTimer = setInterval(() => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) loadMessages()
    }, FALLBACK_POLL_MS)
    return () => {
      closedByEffect = true
      clearInterval(fallbackTimer)
      clearTimeout(reconnectTimer)
      clearTimeout(typingTimer)
      clearInterval(pingTimer)
      try { socketRef.current?.close() } catch { /* already closed */ }
      socketRef.current = null
    }
    // `t` only words the typing notice; it must not reconnect the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, append, loadMessages])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setDraft('')
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      // The server echoes it back as a `message` event.
      socket.send(JSON.stringify({ event: 'message', body, message_type: 'TEXT' }))
      return
    }
    setSending(true)
    try {
      await sendConversationMessage({ conversation_id: conversation.id, body, message_type: 'TEXT' })
      await loadMessages()
      onChanged?.()
    } catch {
      setDraft(body) // give the text back on failure
    } finally {
      setSending(false)
    }
  }

  const participant = conversation.participant || {}
  const title = td(participant.primary_name || conversation.title) || t('dash.common.messages')

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View style={[styles.view5, { gap: 12 }]}>
        <Pressable onPress={onBack} accessibilityLabel={t('dash.common.back')} hitSlop={8}>
          <ArrowLeft size={20} color={COLORS.graphite} />
        </Pressable>
        <Image source={userAvatarSource(participant)} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
        <View style={styles.view6}>
          <Text style={[styles.text13, { fontSize: 15 }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.text14, { fontSize: 11 }]} numberOfLines={1}>
            {typingNotice || td(participant.secondary_name) || t('dash.msg.octabuildChat')}
          </Text>
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => String(message.id)}
        renderItem={({ item }) => <Bubble message={item} mine={Boolean(item.is_mine)} t={t} td={td} />}
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={(
          <Text style={[styles.text15, { fontSize: 13 }]}>{t('dash.msg.startConversation')}</Text>
        )}
      />
      <View style={[styles.view7, { gap: 8 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onFocus={() => {
            const socket = socketRef.current
            if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'typing' }))
          }}
          placeholder={t('dash.msg.typeMessage')}
          multiline
          style={[styles.textInput, { fontSize: 14 }]}
          placeholderTextColor={COLORS.slate[400]}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || sending}
          accessibilityLabel={t('cpd.send')}
          style={[styles.pressable3, styles[!draft.trim() || sending ? 'pressable4' : '']]}
        >
          <Send size={17} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

export default function MessagesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets()
  const { t, td } = useLanguage()
  const { reload: reloadBadges } = useNotifications()
  const [conversations, setConversations] = useState(null)
  const [open, setOpen] = useState(null)
  const openId = route?.params?.conversationId

  const load = useCallback(async () => {
    try {
      const rows = rowsOf(await fetchConversations())
      setConversations(rows)
      return rows
    } catch {
      setConversations((current) => current || [])
      return []
    }
  }, [])

  useEffect(() => {
    load().then((rows) => {
      // Opened for one conversation (from a notification or a profile).
      if (openId) {
        const match = rows.find((row) => String(row.id) === String(openId))
        if (match) setOpen(match)
      }
    })
    const timer = setInterval(load, LIST_POLL_MS)
    return () => clearInterval(timer)
  }, [load, openId])

  useLiveRefresh(load)

  // Android's back button closes an open conversation first, then the screen.
  useEffect(() => {
    if (!open) return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(null)
      load()
      return true
    })
    return () => subscription.remove()
  }, [open, load])

  const changed = useCallback(() => {
    load()
    reloadBadges()
  }, [load, reloadBadges])

  const totalUnread = (conversations || []).reduce((sum, conversation) => sum + Number(conversation.unread_count || 0), 0)

  return (
    <View style={[styles.view8, { paddingBottom: open ? insets.bottom : 0 }]}>
      {/* The status bar's light icons sit on the app's green, as on every other screen. */}
      <View style={[styles.view9, { height: insets.top }]} />
      {open ? (
        <Thread conversation={open} onBack={() => { setOpen(null); changed() }} onChanged={changed} />
      ) : (
        <>
          <View style={[styles.view5, { gap: 12 }]}>
            <Pressable onPress={() => navigation.goBack()} accessibilityLabel={t('dash.common.back')} hitSlop={8}>
              <ArrowLeft size={20} color={COLORS.graphite} />
            </Pressable>
            <Text style={[styles.text16, { fontSize: 18 }]}>{t('dash.msg.chats')}</Text>
            {totalUnread > 0 ? (
              <View style={styles.view10}>
                <Text style={[styles.text17, { fontSize: 11 }]}>{`${totalUnread} ${t('dash.msg.new')}`}</Text>
              </View>
            ) : null}
          </View>
          <FlatList
            data={conversations || []}
            keyExtractor={(conversation) => String(conversation.id)}
            contentContainerStyle={{ padding: 12, flexGrow: 1, paddingBottom: insets.bottom + 12 }}
            ListEmptyComponent={(
              <View style={styles.view11}>
                <MessageCircle size={32} color={COLORS.slate[400]} />
                <Text style={[styles.text18, { fontSize: 15 }]}>
                  {conversations === null ? '…' : t('dash.msg.noConversations')}
                </Text>
                {conversations !== null ? (
                  <Text style={[styles.text19, { fontSize: 12.5 }]}>{t('dash.msg.noConversationsSub')}</Text>
                ) : null}
              </View>
            )}
            renderItem={({ item }) => {
              const participant = item.participant || {}
              const title = td(participant.primary_name || item.title) || t('dash.common.messages')
              const unread = Number(item.unread_count || 0)
              return (
                <Pressable onPress={() => setOpen(item)} style={[styles.pressable5, { gap: 12 }]}>
                  <Image source={userAvatarSource(participant)} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                  <View style={styles.view6}>
                    <View style={[styles.view12, { gap: 8 }]}>
                      <Text style={[styles.text20, { fontSize: 14 }]} numberOfLines={1}>{title}</Text>
                      <Text style={[styles.text21, { fontSize: 10 }]}>{item.latest_message_time || ''}</Text>
                    </View>
                    <Text style={[styles.text14, { fontSize: 11 }]} numberOfLines={1}>
                      {td(participant.secondary_name) || t('dash.msg.octabuildChat')}
                    </Text>
                    <Text style={[styles.text22, unread ? styles.text13 : styles.text23, { fontSize: 12 }]} numberOfLines={1}>
                      {item.latest_message ? messagePreview(item.latest_message, t, td) : t('dash.msg.noMessagesYet')}
                    </Text>
                  </View>
                  {unread > 0 ? (
                    <View style={styles.view13}>
                      <Text style={[styles.text17, { fontSize: 10 }]}>{unread}</Text>
                    </View>
                  ) : null}
                </Pressable>
              )
            }}
          />
        </>
      )}
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 7, width: '88%', alignSelf: 'flex-start', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12.25, paddingVertical: 10.5 },
  text: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.brandTextSoft },
  text2: { marginTop: 1.75, fontFamily: 'Inter_700Bold', color: c.text },
  text3: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  text4: { fontFamily: 'Manrope_800ExtraBold', color: c.brandText },
  view2: { marginTop: 5.25, alignSelf: 'flex-start', borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted, paddingHorizontal: 7, paddingVertical: 1.75 },
  text5: { fontFamily: 'Inter_700Bold', color: c.textSoft },
  pressable: { marginTop: 7, height: 31.5, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 7, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.card, paddingHorizontal: 10.5 },
  text6: { fontFamily: 'Inter_700Bold', color: c.brandText },
  view3: { marginBottom: 7, maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12.25, paddingVertical: 8.75 },
  pressable2: { marginBottom: 5.25, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, backgroundColor: 'rgba(0, 0, 0, 0.05)', paddingHorizontal: 10.5, paddingVertical: 7 },
  text7: { fontFamily: 'Inter_700Bold' },
  text8: { color: '#ffffff' },
  text9: { color: c.text },
  text10: { fontFamily: 'Inter_600SemiBold' },
  view4: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' },
  text11: { color: 'rgba(255, 255, 255, 0.6)' },
  text12: { color: c.textFaint },
  view5: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10.5 },
  view6: { flex: 1 },
  text13: { fontFamily: 'Inter_700Bold', color: c.text },
  text14: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  text15: { textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view7: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  textInput: { maxHeight: 84, flex: 1, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 12.25, paddingVertical: 8.75, fontFamily: 'Inter_600SemiBold', color: c.text },
  pressable3: { height: 38.5, width: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#1a5038' },
  pressable4: { opacity: 0.4 },
  view8: { flex: 1, backgroundColor: c.brandSoft },
  view9: { backgroundColor: '#134127' },
  text16: { flex: 1, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view10: { borderRadius: 9999, backgroundColor: '#236645', paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text17: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view11: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 84 },
  text18: { marginTop: 10.5, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text19: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable5: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  view12: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text20: { flex: 1, fontFamily: 'Inter_700Bold', color: c.text },
  text21: { fontFamily: 'Inter_700Bold', color: c.textFaint },
  text22: { marginTop: 1.75 },
  text23: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  view13: { height: 17.5, minWidth: 17.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#236645', paddingHorizontal: 5.25 },
}))
