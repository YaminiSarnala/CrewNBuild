// Port of the web MessageThread.jsx: the conversation list with unread badges,
// then a thread on the chat WebSocket (/messages/ws/{id}?token=):
//   connected  the latest messages (backlog), then we send {event:'read'}
//   message    a new message (ours or theirs); theirs is marked read at once
//   typing     the other side is typing
//   delivered / read   ours reached / was read by the other side
//   edit       a message was edited (its text and "edited" change)
//   online / offline   the other side's presence
// Sending goes over the socket when it is open, otherwise through REST. The
// socket pings every 25 s and reconnects 2 s after a drop; while it is not
// open the thread re-reads every 5 s over REST, so chat still works without it.
// The list refreshes every 15 s and on a live hint.
//
// As on the web: search inside a conversation, Load older, photos and PDFs
// (POST /files/upload, then a message with attachment_url), editing your own
// text messages (PUT /messages/{id}), Sent / Delivered / Read, and answering a
// request card in the chat. Builder <-> owner requests open their Requests
// page instead (accepted, quoted and assigned there, as on the web).
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Linking, BackHandler, Alert, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { ArrowLeft, ArrowRight, Check, CheckCheck, FileText, MessageCircle, Paperclip, Search, Send, X } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { formatMoney } from '../../utils/countryConfig'
import { editConversationMessage, fetchConversations, fetchConversationMessages, sendConversationMessage } from '../../api/messages'
import { acceptProjectRequest, confirmProjectAssignment, rejectProjectRequest } from '../../api/requests'
import { uploadLocalFile } from '../../api/upload'
import { getCachedAuth, imageSource, imageUrl, websocketUrl } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useProfileGate } from '../../hooks/useProfileGate'
import { useNotifications } from '../../notifications/NotificationsContext'
import { userAvatarSource } from '../../utils/avatars'
import { formatTime } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import { useStoredFiles } from '../../components/StoredFile'

const LIST_POLL_MS = 15000
const PING_MS = 25000
const RECONNECT_MS = 2000
// While the socket is not open (it may be unavailable), the thread re-reads over REST.
const FALLBACK_POLL_MS = 5000
const SEARCH_DELAY_MS = 400

const rowsOf = (data) => (Array.isArray(data) ? data : (data?.messages || data?.conversations || []))
// The API stores UTC without a zone; read it as UTC.
const timeOf = (value) => (value ? formatTime(/[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? value : `${value}Z`, '') : '')
const typeOf = (message) => message.message_type || message.messageType || 'TEXT'

// The latest page from the server, keeping any older messages already loaded above it.
function mergeLatest(current, latest) {
  if (!latest.length) return current
  const ids = new Set(latest.map((item) => item.id))
  const firstId = latest[0].id
  const firstIndex = current.findIndex((item) => item.id === firstId)
  const older = firstIndex > 0 ? current.slice(0, firstIndex).filter((item) => !ids.has(item.id)) : []
  return [...older, ...latest]
}

const SENDER_ROLE_KEYS = { OWNER: 'role.owner', CONTRACTOR: 'role.contractor', SUPPLIER: 'role.supplier', ENGINEER: 'role.engineer' }
const ACTION_STATE_KEYS = { accepted: 'ui.status.accepted', rejected: 'ui.status.rejected', withdrawn: 'ui.shared.statusWithdrawn' }
const CLOSED_STATES = ['accepted', 'rejected', 'withdrawn']
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

// The same message with its card's status changed (accepted / rejected), as the web's requestBodyWithStatus.
function withCardStatus(message, requestId, kind, status) {
  const details = parseCardBody(message.body)
  if (!details || details.kind !== kind || details.request_id !== requestId) return message
  const body = JSON.stringify({ ...details, status })
  return { ...message, body, content: body }
}

// What the conversation list shows for a card message instead of its JSON.
export function messagePreview(body, t, td) {
  const details = parseCardBody(body)
  if (details?.kind === 'PROJECT_ASSIGNMENT') return `${t('dash.msg.projectAssignment')} · ${td(details.project_title) || ''}`
  if (details?.kind === 'PROJECT_REQUEST') return details.project_title && details.project_title !== 'General request' ? `${t('dash.common.request')} · ${td(details.project_title)}` : t('dash.common.request')
  return td(body)
}

function EventCard({ label, title, amountLabel, amount, country, status, text, onView, mine, t, children }) {
  return (
    <View style={[styles.view, mine ? styles.cardMine : null]}>
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
      {children}
      {onView ? (
        <Pressable onPress={onView} style={[styles.pressable, { gap: 4 }]}>
          <Text style={[styles.text6, { fontSize: 12 }]}>{t('request.flow.viewRequest')}</Text>
          <ArrowRight size={12} color={ink('#1a5038')} />
        </Pressable>
      ) : null}
    </View>
  )
}

// Accept (with a quotation where one is needed) or Reject a request from its
// chat card, as the web RequestMessageCard does for requests that have no
// Requests page of their own.
function RequestActions({ details, onUpdate }) {
  const { t, td } = useLanguage()
  const { requireCompleteProfile } = useProfileGate()
  const [quote, setQuote] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const needsQuote = details.request_type === 'OWNER_TO_CONTRACTOR'

  const accept = async () => {
    const amount = Number(quote || 0)
    if (needsQuote && (!amount || amount <= 0)) { setNote(t('dash.msg.validQuotation')); return }
    if (needsQuote && Number(details.budget || 0) > 0 && amount > Number(details.budget)) { setNote(t('dash.msg.quoteWithinBudget')); return }
    // Accepting asks for Complete Profile first, as on the dashboards.
    if (requireCompleteProfile(() => accept())) return
    setBusy(true)
    setNote(needsQuote ? t('dash.msg.sendingQuotation') : t('dash.msg.acceptingRequest'))
    try {
      await acceptProjectRequest(details.request_id, needsQuote ? amount : null)
      onUpdate('accepted')
      setNote(needsQuote ? t('dash.msg.quotationSent') : t('dash.msg.requestAccepted'))
    } catch (error) {
      setNote(td(error?.response?.data?.detail) || t('dash.msg.unableQuotation'))
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    setBusy(true)
    setNote(t('dash.msg.rejectingRequest'))
    try {
      await rejectProjectRequest(details.request_id)
      onUpdate('rejected')
      setNote(t('dash.msg.requestRejected'))
    } catch (error) {
      setNote(td(error?.response?.data?.detail) || t('dash.msg.unableReject'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.actions}>
      {needsQuote ? (
        <TextInput
          value={quote}
          onChangeText={(value) => setQuote(value.replace(/[^\d.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={t('ui.requests.quotePh')}
          placeholderTextColor={COLORS.slate[400]}
          style={styles.quoteInput}
        />
      ) : null}
      <View style={styles.actionRow}>
        <Pressable onPress={accept} disabled={busy} style={[styles.acceptButton, busy ? styles.pressable4 : null]} accessibilityRole="button">
          <Text style={styles.acceptText}>{needsQuote ? t('dash.msg.acceptWithQuote') : t('dash.common.accept')}</Text>
        </Pressable>
        <Pressable onPress={reject} disabled={busy} style={[styles.rejectButton, busy ? styles.pressable4 : null]} accessibilityRole="button">
          <Text style={styles.rejectText}>{t('dash.common.reject')}</Text>
        </Pressable>
      </View>
      {note ? <Text style={styles.actionNote}>{note}</Text> : null}
    </View>
  )
}

// A builder accepts a project assignment from its card (web AssignmentMessageCard).
function AssignmentConfirm({ details, onUpdate }) {
  const { t, td } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const confirm = async () => {
    setBusy(true)
    setNote(t('dash.msg.acceptingAssignment'))
    try {
      await confirmProjectAssignment(details.request_id)
      onUpdate('accepted')
      setNote('')
    } catch (error) {
      setNote(td(error?.response?.data?.detail) || t('dash.msg.unableAcceptAssignment'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <View style={styles.actions}>
      <Pressable onPress={confirm} disabled={busy} style={[styles.acceptButton, busy ? styles.pressable4 : null]} accessibilityRole="button">
        <Text style={styles.acceptText}>{t('dash.msg.acceptAssignment')}</Text>
      </Pressable>
      {note ? <Text style={styles.actionNote}>{note}</Text> : null}
    </View>
  )
}

function CardMessage({ message, mine, t, td, onReplace }) {
  const navigation = useNavigation()
  const role = useSelector((state) => state.auth.user?.role)
  const details = parseCardBody(message.body)
  const event = details ? null : parseChatEvent(message.body)
  if (!details && !event) return null
  // Where this viewer manages a builder <-> owner request (web requestLinkFor):
  // a builder in the Requests tab, an owner in the project's Requests.
  const openRequest = (projectId, requestId, requestType) => {
    if (!requestId || !OWNER_BUILDER_REQUEST_TYPES.includes(requestType || 'CONTRACTOR_TO_OWNER')) return null
    if (role === 'CONTRACTOR') return () => navigation.navigate('ContractorRequestsTab')
    if (role === 'OWNER' && projectId) return () => navigation.navigate('OwnerProject', { projectId, tab: 'requests', requestId })
    return null
  }
  if (event) {
    return <EventCard label={t(event.key)} amountLabel={t('dash.common.amount')} amount={event.amount} text={td(event.text)} mine={mine} t={t} />
  }
  const update = (status) => onReplace((item) => withCardStatus(item, details.request_id, details.kind, status))
  if (details.kind === 'PROJECT_ASSIGNMENT') {
    const accepted = details.status === 'accepted'
    const view = openRequest(details.project_id, details.request_id, details.request_type)
    // With a project award the decision lives in the request; otherwise the builder accepts it here.
    const canConfirm = role === 'CONTRACTOR' && !mine && !accepted && !(details.project_id && details.request_id)
    return (
      <EventCard
        label={t('dash.msg.projectAssignment')}
        title={td(details.project_title)}
        amountLabel={t('dash.common.quotation')}
        amount={details.quotation_amount || details.budget}
        country={details.project_country}
        status={accepted ? t('dash.msg.assignmentAccepted') : t('dash.msg.assignmentSentDot')}
        onView={view}
        mine={mine}
        t={t}
      >
        {canConfirm ? <AssignmentConfirm details={details} onUpdate={update} /> : null}
      </EventCard>
    )
  }
  const quoted = Number(details.quotation_amount || 0) > 0
  const roleKey = SENDER_ROLE_KEYS[details.sender_role]
  const view = openRequest(details.project_id, details.request_id, details.request_type)
  const canAct = !view && !mine && details.receiver_role === role && !CLOSED_STATES.includes(details.status)
  return (
    <EventCard
      label={roleKey ? t('dash.msg.roleRequest', { role: t(roleKey).toLowerCase() }) : t('dash.common.request')}
      title={details.project_title && details.project_title !== 'General request' ? td(details.project_title) : t('dash.common.request')}
      amountLabel={quoted ? t('dash.common.quotation') : t('dash.common.budget')}
      amount={quoted ? details.quotation_amount : details.budget}
      country={details.project_country}
      status={ACTION_STATE_KEYS[details.status] ? t(ACTION_STATE_KEYS[details.status]) : ''}
      onView={view}
      mine={mine}
      t={t}
    >
      {canAct ? <RequestActions details={details} onUpdate={update} /> : null}
    </EventCard>
  )
}

function Bubble({ message, mine, t, td, editing, onStartEdit, onEditChange, onCancelEdit, onSaveEdit, onReplace }) {
  const files = useStoredFiles()
  if (parseCardBody(message.body) || parseChatEvent(message.body)) {
    return <CardMessage message={message} mine={mine} t={t} td={td} onReplace={onReplace} />
  }
  const type = typeOf(message)
  const canEdit = mine && !message.attachment_url && type === 'TEXT'
  const isEditing = editing?.id === message.id
  return (
    <View style={[styles.view3, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {message.attachment_url && type === 'IMAGE' ? (
        <Pressable onPress={() => files.open(message.attachment_url, { gallery: [message.attachment_url] })}>
          <Image source={imageSource(message.attachment_url)} style={{ width: 220, height: 160, borderRadius: 12, marginBottom: 6 }} contentFit="cover" />
        </Pressable>
      ) : null}
      {message.attachment_url && type !== 'IMAGE' ? (
        <Pressable onPress={() => files.open(message.attachment_url)} style={[styles.pressable2, mine ? styles.attachMine : null, { gap: 6 }]}>
          <FileText size={14} color={mine ? '#ffffff' : COLORS.graphite} />
          <Text style={[styles.text7, mine ? styles.text8 : styles.text9, { fontSize: 12.5 }]}>{t('dash.msg.openAttachment')}</Text>
        </Pressable>
      ) : null}
      {files.viewer}
      {isEditing ? (
        <View style={{ gap: 6, minWidth: 200 }}>
          <TextInput value={editing.body} onChangeText={onEditChange} autoFocus multiline style={styles.editInput} />
          <View style={[styles.actionRow, { justifyContent: 'flex-end' }]}>
            <Pressable onPress={onCancelEdit} hitSlop={6}><Text style={styles.editLink}>{t('dash.common.cancel')}</Text></Pressable>
            <Pressable onPress={onSaveEdit} disabled={!editing.body.trim()} hitSlop={6}><Text style={[styles.editLink, { textDecorationLine: 'underline' }]}>{t('dash.common.save')}</Text></Pressable>
          </View>
        </View>
      ) : message.body ? (
        <Text style={[styles.text10, mine ? styles.text8 : styles.text9, { fontSize: 14, lineHeight: 19 }]}>
          {mine ? message.body : td(message.body)}
        </Text>
      ) : null}
      <View style={[styles.view4, { gap: 4 }]}>
        {canEdit && !isEditing ? (
          <Pressable onPress={() => onStartEdit(message)} hitSlop={6}>
            <Text style={[styles.text7, mine ? styles.text11 : styles.text12, { fontSize: 9.5, textDecorationLine: 'underline' }]}>{t('dash.common.edit')}</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.text7, mine ? styles.text11 : styles.text12, { fontSize: 9.5 }]}>
          {`${timeOf(message.created_at)}${message.edited ? ` · ${t('dash.msg.edited')}` : ''}`}
        </Text>
        {mine ? (
          message.read ? <CheckCheck size={12} color="#bfdbfe" accessibilityLabel={t('dash.msg.read')} />
            : message.delivered ? <CheckCheck size={12} color="rgba(255,255,255,0.6)" accessibilityLabel={t('dash.msg.delivered')} />
              : <Check size={12} color="rgba(255,255,255,0.6)" accessibilityLabel={t('dash.msg.sent')} />
        ) : null}
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
  const [online, setOnline] = useState(Boolean(conversation.participant?.online))
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [olderBusy, setOlderBusy] = useState(false)
  const [noOlder, setNoOlder] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [editing, setEditing] = useState(null)
  const listRef = useRef(null)
  const socketRef = useRef(null)
  const queryRef = useRef('')
  const lastIdRef = useRef(null)
  const scrollPendingRef = useRef(true)
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged
  queryRef.current = query

  // A search is applied a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  // Scroll to the newest message only when a new one arrives at the bottom,
  // not when older ones are added above.
  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id
    if (lastId && lastId !== lastIdRef.current) {
      lastIdRef.current = lastId
      scrollPendingRef.current = true
    }
  }, [messages])

  const append = useCallback((message) => {
    if (!message) return
    setMessages((items) => (items.some((item) => item.id === message.id) ? items : [...items, message]))
  }, [])

  // An edit arrives without the viewer's own flags (is_mine); keep them.
  const replaceMessage = useCallback((message) => {
    if (!message) return
    setMessages((items) => items.map((item) => (item.id === message.id ? { ...item, ...message, is_mine: item.is_mine } : item)))
  }, [])

  const loadMessages = useCallback(async ({ merge = false } = {}) => {
    try {
      const params = queryRef.current ? { search: queryRef.current } : {}
      const latest = rowsOf(await fetchConversationMessages(conversation.id, params))
      setMessages((current) => (merge && !queryRef.current ? mergeLatest(current, latest) : latest))
    } catch {
      // the socket backlog fills the thread when it connects
    }
  }, [conversation.id])

  useEffect(() => {
    setNoOlder(false)
    setEditing(null)
    scrollPendingRef.current = true
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
          // The backlog is the latest messages, unfiltered: it must not replace search results.
          if (!queryRef.current) setMessages((current) => mergeLatest(current, payload.messages))
          socket.send(JSON.stringify({ event: 'read' }))
          onChangedRef.current?.()
        }
        if (payload.event === 'message') {
          if (!queryRef.current) append(payload.message)
          if (!payload.message?.is_mine) socket.send(JSON.stringify({ event: 'read' }))
          onChangedRef.current?.()
        }
        if (payload.event === 'typing') {
          setTypingNotice(t('dash.msg.typing'))
          clearTimeout(typingTimer)
          typingTimer = setTimeout(() => setTypingNotice(''), 1800)
        }
        if (payload.event === 'read') {
          setMessages((items) => items.map((item) => (item.is_mine ? { ...item, read: true, delivered: true } : item)))
        }
        if (payload.event === 'delivered') {
          setMessages((items) => items.map((item) => (item.is_mine ? { ...item, delivered: true } : item)))
        }
        if (payload.event === 'edit' && payload.message) {
          replaceMessage(payload.message)
          onChangedRef.current?.()
        }
        if (payload.event === 'online') setOnline(true)
        if (payload.event === 'offline') setOnline(false)
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
      if (socketRef.current?.readyState !== WebSocket.OPEN) loadMessages({ merge: true })
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
  }, [conversation.id, query, append, replaceMessage, loadMessages])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setDraft('')
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN && !queryRef.current) {
      // The server echoes it back as a `message` event.
      socket.send(JSON.stringify({ event: 'message', body, message_type: 'TEXT' }))
      return
    }
    setSending(true)
    try {
      await sendConversationMessage({ conversation_id: conversation.id, body, message_type: 'TEXT' })
      await loadMessages({ merge: true })
      onChanged?.()
    } catch {
      setDraft(body) // give the text back on failure
    } finally {
      setSending(false)
    }
  }

  const loadOlder = async () => {
    if (!messages.length || olderBusy) return
    setOlderBusy(true)
    try {
      const params = { before_id: messages[0].id, ...(queryRef.current ? { search: queryRef.current } : {}) }
      const older = rowsOf(await fetchConversationMessages(conversation.id, params))
      if (!older.length) setNoOlder(true)
      setMessages((current) => {
        const ids = new Set(current.map((item) => item.id))
        return [...older.filter((item) => !ids.has(item.id)), ...current]
      })
    } catch {
      // keep what is shown
    } finally {
      setOlderBusy(false)
    }
  }

  // A photo or a PDF: uploaded first, then sent as a message that carries it.
  const sendAttachment = async (asset, isImage) => {
    setUploadNote(t('dash.msg.uploadingAttachment'))
    try {
      const uploaded = await uploadLocalFile(asset, asset.fileName || (isImage ? 'photo.jpg' : 'document.pdf'))
      const url = uploaded?.url || uploaded?.file_url || uploaded?.path
      if (!url) throw new Error('upload answered without a url')
      await sendConversationMessage({
        conversation_id: conversation.id,
        body: isImage ? t('dash.msg.photoAttached') : (asset.fileName || 'document.pdf'),
        attachment_url: url,
        message_type: isImage ? 'IMAGE' : 'DOCUMENT',
      })
      setUploadNote('')
      scrollPendingRef.current = true
      await loadMessages({ merge: true })
      onChanged?.()
    } catch {
      setUploadNote(t('dash.msg.uploadFailed'))
    }
  }

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    const asset = result.canceled ? null : result.assets?.[0]
    if (asset) sendAttachment({ uri: asset.uri, fileName: asset.fileName || 'photo.jpg', mimeType: asset.mimeType || 'image/jpeg' }, true)
  }

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true })
    const asset = result.canceled ? null : result.assets?.[0]
    if (asset) {
      const isImage = String(asset.mimeType || '').startsWith('image/')
      sendAttachment({ uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType || 'application/pdf' }, isImage)
    }
  }

  const attach = () => {
    Alert.alert(t('dash.common.upload'), undefined, [
      { text: t('se.cal.photo'), onPress: pickPhoto },
      { text: t('ui.requests.document'), onPress: pickDocument },
      { text: t('dash.common.cancel'), style: 'cancel' },
    ])
  }

  const saveEdit = async () => {
    const body = editing?.body?.trim()
    if (!body) return
    try {
      replaceMessage(await editConversationMessage(editing.id, body))
      setEditing(null)
      onChanged?.()
    } catch {
      // stays open so the text is not lost
    }
  }

  const replaceWith = (change) => setMessages((items) => items.map(change))

  const participant = conversation.participant || {}
  const title = td(participant.primary_name || conversation.title) || t('dash.common.messages')
  const subtitle = typingNotice || td(participant.secondary_name) || (online ? t('dash.msg.online') : t('dash.msg.octabuildChat'))

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View style={[styles.view5, { gap: 12 }]}>
        <Pressable onPress={onBack} accessibilityLabel={t('dash.common.back')} hitSlop={8}>
          <ArrowLeft size={20} color={COLORS.graphite} />
        </Pressable>
        <View>
          <Image source={userAvatarSource(participant)} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
          {online ? <View style={styles.onlineDot} /> : null}
        </View>
        <View style={styles.view6}>
          <Text style={[styles.text13, { fontSize: 15 }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.text14, { fontSize: 11 }, typingNotice ? styles.typing : null]} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Pressable
          onPress={() => { if (searchOpen) setSearchText(''); setSearchOpen((value) => !value) }}
          accessibilityLabel={t('dash.msg.searchMessages')}
          hitSlop={8}
        >
          {searchOpen ? <X size={19} color={COLORS.graphite} /> : <Search size={19} color={COLORS.graphite} />}
        </Pressable>
      </View>
      {searchOpen ? (
        <View style={styles.searchBar}>
          <Search size={15} color={COLORS.slate[400]} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('dash.msg.searchMessages')}
            placeholderTextColor={COLORS.slate[400]}
            autoFocus
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => String(message.id)}
        renderItem={({ item }) => (
          <Bubble
            message={item}
            mine={Boolean(item.is_mine)}
            t={t}
            td={td}
            editing={editing}
            onStartEdit={(message) => setEditing({ id: message.id, body: message.body || '' })}
            onEditChange={(body) => setEditing((current) => (current ? { ...current, body } : current))}
            onCancelEdit={() => setEditing(null)}
            onSaveEdit={saveEdit}
            onReplace={replaceWith}
          />
        )}
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
        onContentSizeChange={() => {
          if (!scrollPendingRef.current) return
          scrollPendingRef.current = false
          listRef.current?.scrollToEnd({ animated: false })
        }}
        ListHeaderComponent={messages.length && !noOlder ? (
          <Pressable onPress={loadOlder} disabled={olderBusy} style={styles.olderButton} accessibilityRole="button">
            {olderBusy ? <ActivityIndicator size="small" color={COLORS.brand[700]} /> : <Text style={styles.olderText}>{`↥ ${t('dash.msg.loadOlder')}`}</Text>}
          </Pressable>
        ) : null}
        ListEmptyComponent={(
          <View style={{ alignItems: 'center', gap: 4 }}>
            {query ? <Text style={[styles.text18, { fontSize: 14 }]}>{t('dash.msg.noMessages')}</Text> : null}
            <Text style={[styles.text15, { fontSize: 13 }]}>{query ? t('dash.msg.noMessagesSearch') : t('dash.msg.startConversation')}</Text>
          </View>
        )}
      />
      {uploadNote ? <Text style={styles.uploadNote}>{uploadNote}</Text> : null}
      <View style={[styles.view7, { gap: 8 }]}>
        <Pressable onPress={attach} accessibilityLabel={t('dash.common.upload')} style={styles.attachButton} hitSlop={4}>
          <Paperclip size={18} color={ink('#1a5038')} />
        </Pressable>
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
          style={[styles.pressable3, !draft.trim() || sending ? styles.pressable4 : null]}
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
  // Your messages on the right in green, theirs on the left in a card.
  bubbleMine: { alignSelf: 'flex-end', borderBottomRightRadius: 5, backgroundColor: '#1a5038' },
  bubbleTheirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  cardMine: { alignSelf: 'flex-end' },
  attachMine: { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  onlineDot: { position: 'absolute', right: 0, bottom: 0, height: 11, width: 11, borderRadius: 6, borderWidth: 2, borderColor: c.card, backgroundColor: '#10b981' },
  typing: { color: c.brandText },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 6 },
  searchInput: { flex: 1, paddingVertical: 6, fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text },
  olderButton: { alignSelf: 'center', marginBottom: 10, minHeight: 30, justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14 },
  olderText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.textMuted },
  uploadNote: { paddingHorizontal: 14, paddingTop: 6, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textMuted, backgroundColor: c.card },
  attachButton: { height: 38.5, width: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: soft('#ecfdf5', '#1a5038') },
  editInput: { borderRadius: 8, backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#0f172a' },
  editLink: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  actions: { marginTop: 8, gap: 6 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quoteInput: { height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10, fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text },
  acceptButton: { height: 34, justifyContent: 'center', borderRadius: 8, backgroundColor: '#1a5038', paddingHorizontal: 12 },
  acceptText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  rejectButton: { height: 34, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: soft('#fef2f2', '#dc2626'), paddingHorizontal: 12 },
  rejectText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: ink('#dc2626') },
  actionNote: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
}))