// import { apiClient } from './client'

// export async function fetchConversations() {
//   return (await apiClient.get('/messages/conversations')).data
// }

// export async function fetchConversationMessages(conversationId, params = {}) {
//   return (await apiClient.get(`/messages/conversation/${conversationId}`, { params })).data
// }

// export async function sendConversationMessage(messageDetails) {
//   return (await apiClient.post('/messages/send', messageDetails)).data
// }

// export async function startConversation(conversationDetails) {
//   return (await apiClient.post('/messages/start', conversationDetails)).data
// }


// Port of web services/messages.js — shared chat threads (both apps use them).
import { apiClient } from './client'

export async function fetchConversations() {
  const response = await apiClient.get('/messages/conversations')
  return response.data
}

export async function fetchConversationMessages(conversationId, params = {}) {
  const response = await apiClient.get(`/messages/conversation/${conversationId}`, { params })
  return response.data
}

export async function sendConversationMessage(messageDetails) {
  const response = await apiClient.post('/messages/send', messageDetails)
  return response.data
}

export async function startConversation(conversationDetails) {
  const response = await apiClient.post('/messages/start', conversationDetails)
  return response.data
}

// Edit one of your own text messages; the reply is the updated message
// (the other side gets it as an `edit` event on the chat socket).
export async function editConversationMessage(messageId, body) {
  const response = await apiClient.put(`/messages/${messageId}`, { body })
  return response.data
}