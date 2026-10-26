// Port of the web components/dashboard/requestAwards.js.
//
// The builder <-> owner request is where an assignment is decided. These
// helpers read each accepted request's assignment through
// GET /projects/{id}/award?request_id=, so a request can say exactly where it
// stands. Nothing here writes.
import { useCallback, useEffect, useState } from 'react'
import { fetchProjectAward } from '../../api/requests'
import { createStyles } from '../../theme/createStyles'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'

export const OWNER_BUILDER_REQUEST_TYPES = ['OWNER_TO_CONTRACTOR', 'CONTRACTOR_TO_OWNER']

export function hasAssignmentFlow(request) {
  return Boolean(request?.project_id) && request.status === 'accepted' && OWNER_BUILDER_REQUEST_TYPES.includes(request.request_type)
}

/** [{ [requestId]: award | null }, reload] for every accepted owner/builder request. */
export function useRequestAwards(requests) {
  const eligible = (requests || []).filter(hasAssignmentFlow)
  const key = eligible.map((request) => `${request.project_id}:${request.id}`).join(',')
  const [awards, setAwards] = useState({})
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all(eligible.map((request) => (
      fetchProjectAward(request.project_id, request.id)
        .then((response) => [request.id, response?.award || null])
        // A request with no assignment on it answers "not found".
        .catch(() => [request.id, null])
    ))).then((pairs) => { if (alive) setAwards(Object.fromEntries(pairs)) })
    return () => { alive = false }
    // `key` stands for the eligible list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  // A counter-offer or confirmation changes the award, not the request list.
  useLiveRefresh(reload)
  return [awards, reload]
}

const PHASE_KEYS = {
  negotiating: 'request.flow.negotiating',
  // Negotiation without an assignment, nothing agreed (an offer was rejected).
  quotation_open: 'request.flow.negotiating',
  amount_agreed: 'request.flow.amountAgreed',
  contract_confirmed: 'request.flow.contractConfirmed',
  declined: 'request.flow.declined',
  cancelled: 'request.flow.cancelled',
}

// The web's ring tones: a soft fill, a border and an ink colour per state.
// FLOW_TONES names the styles; flowStyles holds them (themed).
export const FLOW_TONES = {
  action: { box: 'actionBox', text: 'actionText' },
  waiting: { box: 'waitingBox', text: 'waitingText' },
  negotiating: { box: 'negotiatingBox', text: 'negotiatingText' },
  confirmed: { box: 'confirmedBox', text: 'confirmedText' },
  closed: { box: 'closedBox', text: 'closedText' },
}

export const flowStyles = createStyles((c) => ({
  actionBox: { backgroundColor: c.redSoft, borderColor: c.redBorder },
  actionText: { color: c.redText },
  waitingBox: { backgroundColor: c.amberSoft, borderColor: c.amberBorder },
  waitingText: { color: c.amberTextStrong },
  negotiatingBox: { backgroundColor: c.skySoft, borderColor: c.skyBorder },
  negotiatingText: { color: c.skyTextStrong },
  confirmedBox: { backgroundColor: c.emeraldSoft, borderColor: c.emeraldBorder },
  confirmedText: { color: c.emeraldTextStrong },
  closedBox: { backgroundColor: c.muted, borderColor: c.border },
  closedText: { color: c.textSoft },
}))

/**
 * The request's workflow status for this viewer ('builder' | 'owner'), or null
 * when the request has not reached a quotation yet (the caller keeps its own
 * pending / sent / declined label for those).
 */
export function requestFlowStatus(request, award, viewer) {
  // Started project: the pending assignment is locked, nothing to decide.
  if (award?.locked) return { key: 'request.flow.ongoing', tone: 'confirmed', actionRequired: false }
  if (award) {
    const actionRequired = Boolean(award.action_required_by) && award.action_required_by === viewer
    let key = PHASE_KEYS[award.phase]
    if (award.phase === 'assignment_pending') {
      key = viewer === 'builder' ? 'request.flow.assignedYourConfirmation' : 'request.flow.awaitingBuilder'
    }
    // Agreed but NOT assigned: the owner decides whether to assign.
    if (award.phase === 'quotation_agreed') {
      key = viewer === 'builder' ? 'request.flow.awaitingOwnerAssignment' : 'request.flow.readyToAssign'
    }
    const tone = actionRequired
      ? 'action'
      : award.phase === 'contract_confirmed'
        ? 'confirmed'
        : award.phase === 'negotiating'
          ? 'negotiating'
          : ['declined', 'cancelled'].includes(award.phase) ? 'closed' : 'waiting'
    return { key, tone, actionRequired }
  }
  if (!hasAssignmentFlow(request)) return null
  // Accepted, not assigned. Who quoted depends on who opened the request.
  const builderQuotedOnOwnerRequest = request.request_type === 'OWNER_TO_CONTRACTOR'
  if (viewer === 'builder') {
    return { key: builderQuotedOnOwnerRequest ? 'request.flow.quotationSent' : 'request.flow.quotationAccepted', tone: 'waiting', actionRequired: false }
  }
  return { key: builderQuotedOnOwnerRequest ? 'request.flow.quotationReceived' : 'request.flow.quotationAccepted', tone: 'waiting', actionRequired: false }
}

const REQUEST_STATUS_PRIORITY = { accepted: 0, pending: 1, rejected: 2, withdrawn: 3 }
const sameId = (left, right) => left !== null && left !== undefined && right !== null && right !== undefined && String(left) === String(right)

/**
 * The request between the owner and one builder for one project, matched in
 * both directions (a builder may have written first). Accepted outranks
 * pending outranks rejected outranks withdrawn. Port of findClientRequest.
 */
export function findBuilderRequest(requestList, builderId, projectId) {
  const matches = (Array.isArray(requestList) ? requestList : []).filter((request) => (
    OWNER_BUILDER_REQUEST_TYPES.includes(request.request_type)
    && (sameId(request.sender_id, builderId) || sameId(request.receiver_id, builderId))
    && (!projectId || sameId(request.project_id, projectId))
  ))
  if (!matches.length) return undefined
  return [...matches].sort(
    (left, right) => (REQUEST_STATUS_PRIORITY[left.status] ?? 3) - (REQUEST_STATUS_PRIORITY[right.status] ?? 3),
  )[0]
}
