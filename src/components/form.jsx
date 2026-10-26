// Form controls for the owner screens, matching the web's rounded inputs.
//
// The web form uses <select> and <input type="date">, which React Native does
// not have. SelectField opens a sheet listing the options; DateField opens a
// month calendar. Both are plain JS so no native module (and no rebuild) is
// needed, and both store exactly what the web stores: the option value, and a
// calendar date as "YYYY-MM-DD".
import { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, Modal, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, MapPin, Search, X } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { COLORS } from '../theme/tokens'
import { formatCalendarDate, monthName, parseCalendarDate, todayCalendarDate, weekdayName } from '../utils/formatters'
import { budgetInWords } from '../utils/amountInWords'
import { createStyles } from '../theme/createStyles'

const INPUT = 'tone'
const borderFor = (invalid) => (invalid ? 'tone2' : 'tone3')

export function FieldLabel({ children }) {
  if (!children) return null
  return (
    <Text style={[styles.text, { fontSize: 11.5 }]}>
      {children}
    </Text>
  )
}

export function FieldError({ message }) {
  if (!message) return null
  return (
    <Text accessibilityRole="alert" style={[styles.text2, { fontSize: 11 }]}>
      {message}
    </Text>
  )
}

export function TextField({ label, error, invalid, multiline = false, style, containerStyle, ...props }) {
  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        placeholderTextColor={COLORS.slate[400]}
        multiline={multiline}
        style={[styles[INPUT], styles[borderFor(invalid || Boolean(error))], [
          {
            fontSize: 14,
            paddingVertical: multiline ? 11 : 11,
            minHeight: multiline ? 96 : 46,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]]}
        {...props}
      />
      <FieldError message={error} />
    </View>
  )
}

// A <select>. `options` are { value, label }; the stored value is `value`.
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  error,
  containerStyle,
}) {
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.value === value)
  const searchable = options.length > 12
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((option) => String(option.label).toLowerCase().includes(q)) : options
  }, [options, query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        style={[styles.view, styles[INPUT], styles[borderFor(invalid || Boolean(error))], disabled ? styles.pressable : null, { minHeight: 46 }]}
      >
        <Text
          style={[styles.text3, selected ? styles.text4 : styles.text5, { fontSize: 14 }]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={16} color={COLORS.slate[400]} />
      </Pressable>
      <FieldError message={error} />

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.pressable2} onPress={close} />
        <View
          style={[styles.view2, { maxHeight: '75%', paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.view3} />
          <View style={styles.view4}>
            <Text style={[styles.text6, { fontSize: 16 }]} numberOfLines={1}>
              {label || placeholder}
            </Text>
            <Pressable onPress={close} accessibilityLabel={t('dash.common.close')} style={styles.pressable3}>
              <X size={18} color={COLORS.slate[500]} />
            </Pressable>
          </View>
          {searchable ? (
            <View style={styles.view5}>
              <Search size={15} color={COLORS.slate[400]} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholderTextColor={COLORS.slate[400]}
                accessibilityLabel={label || placeholder}
                style={[styles.textInput, { fontSize: 14, paddingVertical: 9 }]}
                autoCorrect={false}
              />
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled">
            {placeholder && !searchable ? (
              <Pressable
                onPress={() => {
                  onChange('')
                  close()
                }}
                style={styles.pressable4}
              >
                <Text style={[styles.text7, { fontSize: 14 }]}>
                  {placeholder}
                </Text>
              </Pressable>
            ) : null}
            {shown.map((option) => {
              const active = option.value === value
              return (
                <Pressable
                  key={String(option.value)}
                  onPress={() => {
                    onChange(option.value)
                    close()
                  }}
                  style={styles.pressable4}
                >
                  <Text
                    style={[styles.text8, active ? styles.text9 : styles.text10, { fontSize: 14 }]}
                  >
                    {option.label}
                  </Text>
                  {active ? <Check size={16} color={COLORS.brand[700]} /> : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const pad = (number) => String(number).padStart(2, '0')
const toCalendarDate = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`

// An <input type="date">: stores "YYYY-MM-DD"; `min` / `max` grey out days the
// same way the web input's min/max attributes do.
export function DateField({ label, value, onChange, min, max, invalid = false, error, placeholder, containerStyle }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const initial = parseCalendarDate(value) || parseCalendarDate(min) || new Date()
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() })

  const openPicker = () => {
    const start = parseCalendarDate(value) || parseCalendarDate(min) || new Date()
    setCursor({ year: start.getFullYear(), month: start.getMonth() })
    setOpen(true)
  }

  const shiftMonth = (delta) => {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (cells.length % 7) cells.push(null)
  const today = todayCalendarDate()

  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.view, styles[INPUT], styles[borderFor(invalid || Boolean(error))], { minHeight: 46, gap: 8 }]}
      >
        <Calendar size={15} color={COLORS.brand[700]} />
        <Text style={[styles.text3, value ? styles.text4 : styles.text5, { fontSize: 14 }]}>
          {value ? formatCalendarDate(value, value) : placeholder || label}
        </Text>
      </Pressable>
      <FieldError message={error} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.pressable5} onPress={() => setOpen(false)}>
          <Pressable style={[styles.pressable6, { maxWidth: 380 }]} onPress={() => {}}>
            <View style={styles.view6}>
              <Pressable onPress={() => shiftMonth(-1)} style={styles.pressable3} accessibilityLabel="Previous month">
                <ChevronLeft size={18} color={COLORS.graphite} />
              </Pressable>
              <Text style={[styles.text11, { fontSize: 15 }]}>
                {`${monthName(cursor.month)} ${cursor.year}`}
              </Text>
              <Pressable onPress={() => shiftMonth(1)} style={styles.pressable3} accessibilityLabel="Next month">
                <ChevronRight size={18} color={COLORS.graphite} />
              </Pressable>
            </View>
            <View style={styles.view7}>
              {Array.from({ length: 7 }, (_, index) => (
                <Text key={index} style={[styles.text12, { fontSize: 11 }]}>
                  {weekdayName(index, { weekday: 'narrow' })}
                </Text>
              ))}
            </View>
            <View style={styles.view8}>
              {cells.map((day, index) => {
                if (!day) return <View key={`blank-${index}`} style={{ width: '14.28%', height: 40 }} />
                const date = toCalendarDate(cursor.year, cursor.month, day)
                const blocked = (min && date < min) || (max && date > max)
                const active = date === value
                return (
                  <Pressable
                    key={date}
                    disabled={Boolean(blocked)}
                    onPress={() => {
                      onChange(date)
                      setOpen(false)
                    }}
                    style={[styles.pressable7, { width: '14.28%', height: 40 }]}
                  >
                    <View
                      style={[styles.view9, styles[active ? 'view10' : date === today ? 'view11' : '']]}
                    >
                      <Text
                        style={[styles[active ? 'text13' : blocked ? 'text14' : 'text15'], { fontSize: 13 }]}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
            <View style={[styles.view12, { gap: 8 }]}>
              {value ? (
                <Pressable
                  onPress={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  style={styles.pressable8}
                >
                  <Text style={[styles.text16, { fontSize: 13 }]}>
                    {t('site.estimate.reset')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setOpen(false)} style={styles.pressable9}>
                <Text style={[styles.text17, { fontSize: 13 }]}>
                  {t('dash.common.cancel')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

// A short status line above or below a form, in the web's mint / red tones.
export function FormNotice({ message, tone = 'info', style }) {
  if (!message) return null
  const tones = {
    info: { box: 'tone4', text: 'tone5' },
    success: { box: 'tone6', text: 'tone7' },
    error: { box: 'tone8', text: 'tone9' },
  }
  const { box, text } = tones[tone] || tones.info
  return (
    <View style={[styles.view13, styles[box], style]}>
      <Text style={[styles.text18, styles[text], { fontSize: 12.5, lineHeight: 18 }]}>
        {message}
      </Text>
    </View>
  )
}

// Port of web BudgetInWords: the typed budget spelled out, translated for display.
export function BudgetInWords({ value, country = 'India', style }) {
  const { td } = useLanguage()
  const words = budgetInWords(value, country)
  if (!words) return null
  return (
    <Text style={[styles.text19, [{ fontSize: 11, marginTop: -6, marginBottom: 12 }, style]]}>
      {td(words)}
    </Text>
  )
}

const FAILURE_MESSAGE_KEYS = {
  invalid: 'location.invalid',
  unknown: 'location.unknown',
  unmapped: 'location.unmapped',
  unavailable: 'location.unavailable',
  error: 'location.notFound',
}

function sameBranch(branch, selectedBranch) {
  return Boolean(selectedBranch) && branch.name === selectedBranch.name && branch.pincode === selectedBranch.pincode
}

// Port of web PincodeAreaHint: the lookup's status, or the list of postal
// branches under the pincode to choose from.
export function PincodeAreaHint({ lookupState, selectedBranch = null, onSelectBranch }) {
  const { t, td } = useLanguage()
  if (!lookupState?.message && !lookupState?.messageKey) return null

  const line = (text, color) => (
    <Text style={[styles.text20, { fontSize: 11.5, color, marginTop: -6, marginBottom: 12 }]}>
      {text}
    </Text>
  )

  if (lookupState.status === 'loading') return line(t('location.fetching'), COLORS.brand[700])
  if (lookupState.status === 'incomplete') return line(t('location.incomplete'), COLORS.slate[500])
  if (FAILURE_MESSAGE_KEYS[lookupState.status]) return line(t(FAILURE_MESSAGE_KEYS[lookupState.status]), COLORS.warm)
  if (lookupState.status === 'info') {
    return line(lookupState.messageKey ? t(lookupState.messageKey) : td(lookupState.message), COLORS.slate[500])
  }

  const branches = lookupState.branches || []
  if (!onSelectBranch || !branches.length) return line(td(lookupState.message), COLORS.brand[700])

  return (
    <View style={{ marginTop: -4, marginBottom: 12 }}>
      <Text style={[styles.text21, { fontSize: 11.5 }]}>
        {t('location.branchesFound', { count: branches.length, pincode: branches[0].pincode })}
      </Text>
      <View style={[styles.view14, { gap: 6 }]}>
        {branches.map((branch) => {
          const selected = sameBranch(branch, selectedBranch)
          return (
            <Pressable
              key={`${branch.pincode}-${branch.name}`}
              onPress={() => onSelectBranch(branch)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[styles.pressable10, selected ? styles.pressable11 : styles.pressable12]}
            >
              <View style={[styles.view, { gap: 6 }]}>
                <MapPin size={13} color={COLORS.brand[600]} />
                <Text style={[styles.text22, { fontSize: 13 }]} numberOfLines={1}>
                  {td(branch.name)}
                </Text>
                {selected ? (
                  <CheckCircle2 size={16} color={COLORS.brand[600]} />
                ) : branch.branch_type ? (
                  <Text style={[styles.text23, { fontSize: 10 }]}>
                    {td(branch.branch_type)}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.text24, { fontSize: 11 }]}>
                {[branch.city ? td(branch.city) : null, td(branch.district), td(branch.state)].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  tone: { borderRadius: 10.5, borderWidth: 1, backgroundColor: c.card, paddingHorizontal: 12.25, fontFamily: 'Inter_400Regular', color: c.text },
  tone2: { borderColor: '#ef4444', backgroundColor: c.redSoft },
  tone3: { borderColor: c.border },
  text: { marginBottom: 3.5, fontFamily: 'Inter_700Bold', color: c.textMuted },
  text2: { marginTop: 3.5, fontFamily: 'Inter_600SemiBold', color: c.redTextSoft },
  view: { flexDirection: 'row', alignItems: 'center' },
  pressable: { opacity: 0.5 },
  text3: { flex: 1, fontFamily: 'Inter_400Regular' },
  text4: { color: c.text },
  text5: { color: c.textFaint },
  pressable2: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  view2: { borderTopLeftRadius: 21, borderTopRightRadius: 21, backgroundColor: c.card, paddingHorizontal: 14, paddingTop: 10.5 },
  view3: { marginBottom: 7, height: 3.5, width: 35, alignSelf: 'center', borderRadius: 9999, backgroundColor: c.mutedStrong },
  view4: { marginBottom: 7, flexDirection: 'row', alignItems: 'center' },
  text6: { flex: 1, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  pressable3: { padding: 7 },
  view5: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5 },
  textInput: { flex: 1, paddingHorizontal: 7, fontFamily: 'Inter_400Regular', color: c.text },
  pressable4: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 12.25 },
  text7: { flex: 1, fontFamily: 'Inter_400Regular', color: c.textFaint },
  text8: { flex: 1 },
  text9: { fontFamily: 'Inter_700Bold', color: c.brandText },
  text10: { fontFamily: 'Inter_400Regular', color: c.text },
  pressable5: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 17.5 },
  pressable6: { width: '100%', borderRadius: 21, backgroundColor: c.card, padding: 14 },
  view6: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  text11: { flex: 1, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view7: { flexDirection: 'row' },
  text12: { flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.textFaint },
  view8: { marginTop: 3.5, flexDirection: 'row', flexWrap: 'wrap' },
  pressable7: { alignItems: 'center', justifyContent: 'center' },
  view9: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  view10: { backgroundColor: '#1a5038' },
  view11: { borderWidth: 1, borderColor: '#9dc5af' },
  text13: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  text14: { fontFamily: 'Inter_400Regular', color: '#cbd5e1' },
  text15: { fontFamily: 'Inter_600SemiBold', color: c.text },
  view12: { marginTop: 10.5, flexDirection: 'row', justifyContent: 'flex-end' },
  pressable8: { borderRadius: 10.5, paddingHorizontal: 14, paddingVertical: 8.75 },
  text16: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  pressable9: { borderRadius: 10.5, backgroundColor: c.muted, paddingHorizontal: 14, paddingVertical: 8.75 },
  text17: { fontFamily: 'Inter_700Bold', color: c.text },
  tone4: { borderColor: c.brandBorder, backgroundColor: c.brandSoft },
  tone5: { color: c.brandTextStrong },
  tone6: { borderColor: c.emeraldBorderSoft, backgroundColor: c.emeraldSoft },
  tone7: { color: c.emeraldTextStrong },
  tone8: { borderColor: c.redBorderSoft, backgroundColor: c.redSoft },
  tone9: { color: c.redText },
  view13: { borderRadius: 10.5, borderWidth: 1, paddingHorizontal: 12.25, paddingVertical: 8.75 },
  text18: { fontFamily: 'Inter_700Bold' },
  text19: { fontFamily: 'Inter_600SemiBold', color: c.brandTextSoft },
  text20: { fontFamily: 'Inter_600SemiBold' },
  text21: { fontFamily: 'Inter_700Bold', color: c.textSecondary },
  view14: { marginTop: 5.25 },
  pressable10: { borderRadius: 10.5, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  pressable11: { borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  pressable12: { borderColor: c.border, backgroundColor: c.card },
  text22: { flex: 1, fontFamily: 'Inter_700Bold', color: c.text },
  text23: { fontFamily: 'Inter_700Bold', color: c.textFaint },
  text24: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
}))
