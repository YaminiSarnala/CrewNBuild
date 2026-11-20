// Brings a failed form field into view. Every scrolling container that holds a
// form (DashboardShell, StackScreenShell, SheetModal) provides the context; every
// shared field error (Field, LabeledInput, TextField / SelectField / DateField's
// FieldError) drops an <ErrorAnchor /> next to its message. When a save marks
// fields red, the anchors that just appeared report where they are, and the
// container scrolls to the highest one -- only if it is out of sight.
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { View } from 'react-native'

const ScrollToErrorContext = createContext(null)

// How far above the error message to land, so its field and label show too.
const FIELD_ABOVE = 110

/**
 * For a container: returns the context value plus the ScrollView handlers that
 * keep the visible window known. Spread `scrollProps` onto the ScrollView.
 */
export function useScrollToErrorContainer(scrollRef) {
  const view = useRef({ offset: 0, height: 0 })
  const value = useMemo(() => {
    let pending = null
    let timer = null
    return {
      scrollRef,
      report(y) {
        pending = pending == null ? y : Math.min(pending, y)
        if (timer) return
        // Collect every field that turned red in this save, then move once.
        timer = setTimeout(() => {
          timer = null
          const target = pending
          pending = null
          const { offset, height } = view.current
          const top = target - FIELD_ABOVE
          const visible = height > 0 && top >= offset && target + 40 <= offset + height
          if (!visible) scrollRef.current?.scrollTo?.({ y: Math.max(0, top), animated: true })
        }, 60)
      },
    }
  }, [scrollRef])
  const scrollProps = useMemo(() => ({
    onScroll: (event) => { view.current.offset = event.nativeEvent.contentOffset.y },
    onLayout: (event) => { view.current.height = event.nativeEvent.layout.height },
    scrollEventThrottle: 32,
  }), [])
  return { value, scrollProps }
}

export function ScrollToErrorProvider({ value, children }) {
  return <ScrollToErrorContext.Provider value={value}>{children}</ScrollToErrorContext.Provider>
}

/** Place next to a field's error message; reports its position when it appears. */
export function ErrorAnchor() {
  const context = useContext(ScrollToErrorContext)
  const anchor = useRef(null)
  useEffect(() => {
    if (!context) return undefined
    // After layout: the message has just mounted.
    const frame = requestAnimationFrame(() => {
      const inner = context.scrollRef.current?.getInnerViewRef?.()
      if (!inner || !anchor.current?.measureLayout) return
      try {
        anchor.current.measureLayout(inner, (_x, y) => context.report(y), () => {})
      } catch {
        // Not measurable (e.g. inside a nested modal): no scroll, nothing else changes.
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [context])
  return <View ref={anchor} collapsable={false} pointerEvents="none" style={{ height: 0 }} />
}
