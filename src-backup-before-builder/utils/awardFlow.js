// The builder <-> owner request is where an assignment is decided. Port of the
// web's components/dashboard/requestAwards.js, from the BUILDER's side only,
// with the English labels the web shows. Nothing here writes.
// Labels come from the web request.flow.* keys (translated via an optional `t`).
import { translatorFrom } from '../i18n/LanguageContext'

const OWNER_BUILDER_REQUEST_TYPES = ['OWNER_TO_CONTRACTOR', 'CONTRACTOR_TO_OWNER']

export function hasAssignmentFlow(request) {
  return Boolean(request?.project_id)
    && String(request.status || '').toLowerCase() === 'accepted'
    && OWNER_BUILDER_REQUEST_TYPES.includes(request.request_type)
}

const PHASE_KEYS = {
  negotiating: 'request.flow.negotiating',
  amount_agreed: 'request.flow.amountAgreed',
  contract_confirmed: 'request.flow.contractConfirmed',
  declined: 'request.flow.declined',
  cancelled: 'request.flow.cancelled',
}

/**
 * Assigned, work already recorded, contract still unconfirmed. The award API
 * sets `release_blocked_reason` for exactly that case.
 */
export function awardWorkStartedUnconfirmed(award) {
  return Boolean(award?.release_blocked_reason)
    && award.assigned === true
    && ['assignment_pending', 'amount_agreed'].includes(award.phase)
}

// tone: action | waiting | negotiating | confirmed | closed
export const FLOW_TONE_COLORS = {
  action: { bg: '#fef2f2', fg: '#b91c1c' },
  waiting: { bg: '#fffbeb', fg: '#92400e' },
  negotiating: { bg: '#f0f9ff', fg: '#075985' },
  confirmed: { bg: '#ecfdf5', fg: '#065f46' },
  closed: { bg: '#f1f5f9', fg: '#334155' },
}

/**
 * The request's workflow status for the builder, or null when the request has
 * not reached a quotation yet (the board keeps its own status for those).
 * Returns { label, tone, actionRequired }.
 */
export function builderFlowStatus(request, award, t) {
  const tr = translatorFrom(t)
  if (award?.locked) return { label: tr('request.flow.ongoing'), tone: 'confirmed', actionRequired: false }
  if (award) {
    const actionRequired = Boolean(award.action_required_by) && award.action_required_by === 'builder'
    let key = PHASE_KEYS[award.phase]
    if (award.phase === 'assignment_pending') key = 'request.flow.assignedYourConfirmation'
    if (awardWorkStartedUnconfirmed(award)) key = 'request.flow.workStartedYourConfirmation'
    if (award.phase === 'quotation_agreed' || award.phase === 'quotation_open') key = 'request.flow.yourConfirmationRequired'
    if (award.phase === 'builder_confirmed') key = 'request.flow.confirmedAwaitingAssignment'
    const label = key ? tr(key) : String(award.phase || '').toUpperCase()
    const tone = actionRequired
      ? 'action'
      : award.phase === 'contract_confirmed'
        ? 'confirmed'
        : award.phase === 'negotiating'
          ? 'negotiating'
          : ['declined', 'cancelled'].includes(award.phase) ? 'closed' : 'waiting'
    return { label, tone, actionRequired }
  }
  if (!hasAssignmentFlow(request)) return null
  // Accepted, not assigned. Who quoted depends on who opened the request.
  const builderQuotedOnOwnerRequest = request.request_type === 'OWNER_TO_CONTRACTOR'
  return { label: tr(builderQuotedOnOwnerRequest ? 'request.flow.quotationSent' : 'request.flow.quotationAccepted'), tone: 'waiting', actionRequired: false }
}