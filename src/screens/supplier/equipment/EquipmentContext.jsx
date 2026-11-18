// An Equipment Supplier's items (GET /equipment/items) and the Site Engineers'
// requests (GET /equipment/requests), loaded once and shared by the Dashboard,
// Inventory, Requests and Assignments tabs and the Add / Edit screen, as the
// web SupplierDashboard keeps equipmentItemList and equipmentRequestList.
// Nothing loads for any other supplier kind.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchEquipmentItems, fetchSupplierEquipmentRequests } from '../../../api/equipment'
import { useLiveRefresh } from '../../../hooks/useLiveRefresh'
import { useSupplier } from '../SupplierContext'
import { EQUIPMENT } from '../supplierKinds'

const EquipmentContext = createContext(null)

export function EquipmentProvider({ children }) {
  const { kind } = useSupplier()
  const isEquipment = kind === EQUIPMENT
  const [items, setItems] = useState([])
  const [requests, setRequests] = useState([])
  // idle | ready | error, per list
  const [itemsStatus, setItemsStatus] = useState('idle')
  const [requestsStatus, setRequestsStatus] = useState('idle')
  // Bumped on every request reload, so an open usage log re-reads with it.
  const [refreshKey, setRefreshKey] = useState(0)
  const latest = useRef(0)
  // The last action's message ({ tone, text }), shown on the Inventory tab even
  // when it was the Add / Edit screen that saved.
  const [notice, setNotice] = useState(null)

  const reload = useCallback(async () => {
    if (!isEquipment) return
    const run = ++latest.current
    await Promise.all([
      fetchEquipmentItems()
        .then((list) => { if (run === latest.current) { setItems(Array.isArray(list) ? list : []); setItemsStatus('ready') } })
        .catch(() => { if (run === latest.current) setItemsStatus((current) => (current === 'ready' ? current : 'error')) }),
      fetchSupplierEquipmentRequests()
        .then((list) => {
          if (run !== latest.current) return
          setRequests(Array.isArray(list) ? list : [])
          setRequestsStatus('ready')
          setRefreshKey((key) => key + 1)
        })
        .catch(() => { if (run === latest.current) setRequestsStatus((current) => (current === 'ready' ? current : 'error')) }),
    ])
  }, [isEquipment])

  useEffect(() => {
    if (!isEquipment) {
      latest.current += 1
      setItems([])
      setRequests([])
      setItemsStatus('idle')
      setRequestsStatus('idle')
      setNotice(null)
      return
    }
    reload()
  }, [isEquipment, reload])

  useLiveRefresh(reload)

  // A saved item replaces its row at once; the full reload then brings the
  // backend's own availability figures.
  const upsertItem = useCallback((saved) => {
    if (!saved?.id) return
    setItems((current) => (current.some((item) => item.id === saved.id)
      ? current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item))
      : [saved, ...current]))
  }, [])

  const value = useMemo(() => ({
    items, requests, itemsStatus, requestsStatus, refreshKey, reload, upsertItem, notice, setNotice,
  }), [items, requests, itemsStatus, requestsStatus, refreshKey, reload, upsertItem, notice])

  return <EquipmentContext.Provider value={value}>{children}</EquipmentContext.Provider>
}

export function useEquipment() {
  return useContext(EquipmentContext) || {
    items: [], requests: [], itemsStatus: 'idle', requestsStatus: 'idle', refreshKey: 0, reload: async () => {}, upsertItem: () => {},
    notice: null, setNotice: () => {},
  }
}
