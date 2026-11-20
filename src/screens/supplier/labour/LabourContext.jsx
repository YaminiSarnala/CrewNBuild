// A Labour Supplier's services (GET /labor/services), the Site Engineers'
// requests (GET /labor/requests) and the trade list (GET /labor/trades),
// loaded once and shared by the Dashboard, Services, Requests and Assignments
// tabs and the Add / Edit Service screen -- as the web SupplierDashboard keeps
// laborServiceList, laborRequestList and laborTrades. Nothing loads for any
// other supplier kind.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLabourServices, fetchLabourTrades, fetchSupplierLabourRequests } from '../../../api/labour'
import { useLiveRefresh } from '../../../hooks/useLiveRefresh'
import { useSupplier } from '../SupplierContext'
import { LABOUR } from '../supplierKinds'

const LabourContext = createContext(null)

export function LabourProvider({ children }) {
  const { kind } = useSupplier()
  const isLabour = kind === LABOUR
  const [services, setServices] = useState([])
  const [requests, setRequests] = useState([])
  const [trades, setTrades] = useState([])
  // idle | ready | error, per list
  const [servicesStatus, setServicesStatus] = useState('idle')
  const [requestsStatus, setRequestsStatus] = useState('idle')
  // Bumped on every request reload, so an open attendance list re-reads with it.
  const [refreshKey, setRefreshKey] = useState(0)
  const latest = useRef(0)

  const reload = useCallback(async () => {
    if (!isLabour) return
    const run = ++latest.current
    await Promise.all([
      fetchLabourServices()
        .then((list) => { if (run === latest.current) { setServices(Array.isArray(list) ? list : []); setServicesStatus('ready') } })
        .catch(() => { if (run === latest.current) setServicesStatus((current) => (current === 'ready' ? current : 'error')) }),
      fetchSupplierLabourRequests()
        .then((list) => {
          if (run !== latest.current) return
          setRequests(Array.isArray(list) ? list : [])
          setRequestsStatus('ready')
          setRefreshKey((key) => key + 1)
        })
        .catch(() => { if (run === latest.current) setRequestsStatus((current) => (current === 'ready' ? current : 'error')) }),
    ])
  }, [isLabour])

  useEffect(() => {
    if (!isLabour) {
      latest.current += 1
      setServices([])
      setRequests([])
      setTrades([])
      setServicesStatus('idle')
      setRequestsStatus('idle')
      return
    }
    reload()
    // The trade vocabulary changes only with a backend release: read once.
    fetchLabourTrades().then((list) => setTrades(Array.isArray(list) ? list : [])).catch(() => setTrades([]))
  }, [isLabour, reload])

  // A new request, a cancellation, completion or saved attendance elsewhere.
  useLiveRefresh(reload)

  // A saved service replaces its row at once; the reload then brings the
  // backend's own available / deployed figures.
  const upsertService = useCallback((saved) => {
    if (!saved?.id) return
    setServices((current) => (current.some((service) => service.id === saved.id)
      ? current.map((service) => (service.id === saved.id ? { ...service, ...saved } : service))
      : [...current, saved]))
  }, [])

  const value = useMemo(() => ({
    services, requests, trades, servicesStatus, requestsStatus, refreshKey, reload, upsertService,
  }), [services, requests, trades, servicesStatus, requestsStatus, refreshKey, reload, upsertService])

  return <LabourContext.Provider value={value}>{children}</LabourContext.Provider>
}

export function useLabour() {
  return useContext(LabourContext) || {
    services: [], requests: [], trades: [], servicesStatus: 'idle', requestsStatus: 'idle', refreshKey: 0,
    reload: async () => {}, upsertService: () => {},
  }
}
