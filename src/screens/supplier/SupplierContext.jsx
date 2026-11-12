// The signed-in supplier's profile (GET /suppliers/{id}/profile), loaded once
// and shared by every supplier screen, as the web SupplierDashboard keeps
// supplierProfileDetails. The account payload has no Supplier Category, so this
// profile is also what tells a Material supplier from a Labour or Equipment one.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { fetchSupplierProfile } from '../../api/profiles'
import { supplierKind } from './supplierKinds'

const SupplierContext = createContext(null)

export function SupplierProvider({ children }) {
  const user = useSelector((state) => state.auth.user)
  const isSupplier = user?.role === 'SUPPLIER'
  const [profile, setProfile] = useState(null)
  // idle | loading | ready | missing (no profile row yet) | error
  const [status, setStatus] = useState('idle')

  const reload = useCallback(async () => {
    if (!isSupplier || !user?.id) return null
    setStatus((current) => (current === 'ready' ? current : 'loading'))
    try {
      const details = await fetchSupplierProfile(user.id)
      setProfile(details)
      setStatus('ready')
      return details
    } catch (error) {
      setStatus(error?.response?.status === 404 ? 'missing' : 'error')
      return null
    }
  }, [isSupplier, user?.id])

  useEffect(() => {
    if (!isSupplier) {
      setProfile(null)
      setStatus('idle')
      return
    }
    reload()
  }, [isSupplier, reload])

  const value = useMemo(() => ({
    profile,
    setProfile,
    status,
    reload,
    kind: supplierKind(profile?.supplier_category),
  }), [profile, status, reload])

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>
}

export function useSupplier() {
  return useContext(SupplierContext) || { profile: null, setProfile: () => {}, status: 'idle', reload: async () => null, kind: null }
}
