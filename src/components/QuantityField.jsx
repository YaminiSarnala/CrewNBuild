// A quantity typed straight in (500 bags, 100 rods), with - and + for small
// changes and the unit beside it — port of the web components/shop/QuantityField.jsx.
// A quantity the unit cannot take is named under the field.
import { View, Text, TextInput, Pressable } from 'react-native'
import { Minus, Plus } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { quantityProblem, stepQuantity } from '../utils/quantityUnits'
import { COLORS } from '../theme/tokens'
import { ink } from '../theme/tint'
import { createStyles } from '../theme/createStyles'

export default function QuantityField({ value, unit, onChange, disabled = false, label, large = false }) {
  const { t, td } = useLanguage()
  const text = value == null ? '' : String(value)
  const problem = text.trim() ? quantityProblem(text, unit) : ''
  const size = large ? 44 : 36
  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.box, { height: size }, problem ? styles.boxInvalid : null]}>
          <Pressable disabled={disabled || !text} onPress={() => onChange(stepQuantity(text, -1))} accessibilityLabel={t('shop.decrease')} style={[styles.step, { width: size }, disabled || !text ? styles.dim : null]}>
            <Minus size={14} color={COLORS.slate[600]} />
          </Pressable>
          <TextInput
            value={text}
            editable={!disabled}
            onChangeText={(next) => onChange(next.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={COLORS.slate[400]}
            accessibilityLabel={label}
            style={[styles.input, { width: large ? 80 : 60, fontSize: large ? 16 : 14 }]}
          />
          <Pressable disabled={disabled} onPress={() => onChange(stepQuantity(text, 1))} accessibilityLabel={t('shop.increase')} style={[styles.step, styles.plus, { width: size }, disabled ? styles.dim : null]}>
                       <Plus size={14} color={ink('#134127')} />
          </Pressable>
        </View>
        {unit ? <Text style={styles.unit}>{td(unit)}</Text> : null}
      </View>
      {problem ? <Text style={styles.error}>{problem === 'whole' ? t('store.quantityWhole', { unit: td(unit) }) : t('store.quantityInvalid')}</Text> : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  boxInvalid: { borderColor: '#dc2626' },
  step: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  plus: { backgroundColor: c.brandSoft },
  dim: { opacity: 0.4 },
  input: { height: '100%', borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.borderSoft, textAlign: 'center', fontWeight: '800', color: c.text, paddingVertical: 0 },
  unit: { fontSize: 12, fontWeight: '700', color: c.textMuted },
  error: { marginTop: 4, maxWidth: 190, fontSize: 11.5, fontWeight: '700', color: '#dc2626' },
}))