/**
 * The profile-completion gate — port of the web hooks/useProfileGate.js.
 *
 * Signing up no longer forces anyone through Complete Profile. The few actions
 * that genuinely need profile data (sending or accepting a request, creating a
 * project, buying) ask for it when they are used, and resume by themselves
 * once the profile is saved:
 *
 *   const { requireCompleteProfile } = useProfileGate()
 *   const send = () => {
 *     if (requireCompleteProfile(send)) return
 *     …the existing body…
 *   }
 *
 * The web has to park the action in sessionStorage because the page reloads;
 * on native the screen that asked stays mounted under CompleteProfile, so the
 * callback itself is kept in memory and called when the form is saved.
 */
import { useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'

let pendingAction = null

export function profileIsIncomplete(user) {
  // Only an explicit false counts: a user object that predates the field must
  // not be pushed into the form for no reason.
  return Boolean(user) && user.profile_complete === false
}

/** Reads and clears in one step, so an action can never replay twice. */
export function takePendingProfileAction() {
  const action = pendingAction
  pendingAction = null
  return action
}

export function clearPendingProfileAction() {
  pendingAction = null
}

export function useProfileGate() {
  const user = useSelector((state) => state.auth.user)
  const navigation = useNavigation()

  /** Returns true when CompleteProfile was opened instead — the caller stops. */
  const requireCompleteProfile = (resume) => {
    if (!profileIsIncomplete(user)) return false
    pendingAction = typeof resume === 'function' ? resume : null
    navigation.navigate('CompleteProfile', { gated: true })
    return true
  }

  return { requireCompleteProfile, profileComplete: !profileIsIncomplete(user) }
}
