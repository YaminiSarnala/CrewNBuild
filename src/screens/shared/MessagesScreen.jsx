// Port of web MessageThread.jsx: conversation list with unread badges, then a
// WhatsApp-style thread. The open thread refreshes every 5 seconds; opening a
// thread clears its unread count server-side (same as web).
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { ArrowLeft, Send, MessageCircle } from 'lucide-react-native'
import { fetchConversations, fetchConversationMessages, sendConversationMessage } from '../../api/messages'
import { COLORS } from '../../theme/tokens'

const POLL_MS = 5000

function Bubble({ message, mine }) {
  return (
    <View className={`mb-2 max-w-[80%] rounded-2xl px-3.5 py-2.5 ${mine ? 'self-end rounded-br-md bg-brand-700' : 'self-start rounded-bl-md bg-white border border-slate-200'}`}>
      <Text className={`text-[14px] font-semibold ${mine ? 'text-white' : 'text-graphite'}`}>{message.body}</Text>
      {!!message.created_at && (
        <Text className={`mt-1 text-[9px] font-bold ${mine ? 'text-white/60' : 'text-slate-400'}`}>
          {String(message.created_at).slice(11, 16)}
        </Text>
      )}
    </View>
  )
}

function Thread({ conversation, myId, onBack }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    let active = true
    const load = () => fetchConversationMessages(conversation.id)
      .then((rows) => { if (active) setMessages(Array.isArray(rows) ? rows : (rows?.messages || [])) })
      .catch(() => {})
    load()
    const timer = setInterval(load, POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [conversation.id])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')
    // optimistic append, same as web
    setMessages((current) => [...current, { id: `tmp-${Date.now()}`, sender_id: myId, body, created_at: new Date().toISOString() }])
    try {
      await sendConversationMessage({ conversation_id: conversation.id, body, message_type: 'TEXT' })
      const rows = await fetchConversationMessages(conversation.id)
      setMessages(Array.isArray(rows) ? rows : (rows?.messages || []))
    } catch {
      setDraft(body) // give the text back on failure
    } finally {
      setSending(false)
    }
  }

  const title = conversation.participant?.primary_name || conversation.title || 'Chat'

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Pressable onPress={onBack}><ArrowLeft size={20} color={COLORS.graphite} /></Pressable>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-100">
          <Text className="text-sm font-extrabold text-brand-800">{title.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text className="flex-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{title}</Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => String(message.id)}
        renderItem={({ item }) => <Bubble message={item} mine={String(item.sender_id) === String(myId)} />}
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <View className="flex-row items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          multiline
          className="max-h-24 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] font-semibold text-graphite"
          placeholderTextColor={COLORS.slate[400]}
        />
        <Pressable onPress={send} disabled={!draft.trim() || sending} className={`h-11 w-11 items-center justify-center rounded-full bg-brand-700 ${!draft.trim() || sending ? 'opacity-40' : ''}`}>
          <Send size={17} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const user = useSelector((state) => state.auth.user)
  const [conversations, setConversations] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let active = true
    const load = () => fetchConversations()
      .then((rows) => { if (active) setConversations(Array.isArray(rows) ? rows : (rows?.conversations || [])) })
      .catch(() => { if (active) setConversations([]) })
    load()
    const timer = setInterval(load, POLL_MS * 3)
    return () => { active = false; clearInterval(timer) }
  }, [])

  return (
    <View className="flex-1 bg-brand-50" style={{ paddingTop: insets.top }}>
      {open ? (
        <Thread conversation={open} myId={user?.id} onBack={() => { setOpen(null) }} />
      ) : (
        <>
          <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <Pressable onPress={() => navigation.goBack()}><ArrowLeft size={20} color={COLORS.graphite} /></Pressable>
            <Text className="text-lg font-extrabold text-graphite">Messages</Text>
          </View>
          <FlatList
            data={conversations || []}
            keyExtractor={(conversation) => String(conversation.id)}
            contentContainerStyle={{ padding: 12, flexGrow: 1 }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-8 pt-24">
                <MessageCircle size={32} color={COLORS.slate[400]} />
                <Text className="mt-3 text-center text-sm font-semibold text-slate-500">
                  {conversations === null ? 'Loading chats…' : 'No conversations yet. Accepting a request opens a chat with the other side.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const title = item.participant?.primary_name || item.title || 'Chat'
              const unread = Number(item.unread_count || 0)
              return (
                <Pressable onPress={() => setOpen(item)} className="mb-2 flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-100">
                    <Text className="text-[15px] font-extrabold text-brand-800">{title.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>{title}</Text>
                      <Text className="ml-2 text-[10px] font-bold text-slate-400">{item.latest_message_time || ''}</Text>
                    </View>
                    <Text className={`mt-0.5 text-xs ${unread ? 'font-bold text-graphite' : 'font-semibold text-slate-500'}`} numberOfLines={1}>
                      {item.latest_message || 'No messages yet'}
                    </Text>
                  </View>
                  {unread > 0 && (
                    <View className="h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5">
                      <Text className="text-[10px] font-extrabold text-white">{unread}</Text>
                    </View>
                  )}
                </Pressable>
              )
            }}
          />
        </>
      )}
    </View>
  )
}