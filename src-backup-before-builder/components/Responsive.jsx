// Layout primitives that make every screen work on phones and tablets.
import { View } from 'react-native'
import { useResponsive } from '../hooks/useResponsive'

/**
 * Caps content width and centres it on tablets. On phones it is a no-op, so
 * wrapping a screen in this is always safe.
 */
export function ContentWrap({ children, style, padded = false }) {
  const { maxContentWidth, gutter, isTablet } = useResponsive()
  return (
    <View style={[{ width: '100%', alignItems: 'center' }, style]}>
      <View
        style={{
          width: '100%',
          maxWidth: maxContentWidth,
          paddingHorizontal: padded ? gutter : 0,
        }}
      >
        {children}
      </View>
    </View>
  )
}

/**
 * Responsive card grid. 1 column on phones, 2 on tablets, 3 on large tablets
 * in landscape. Uses percentage widths with a gap so it reflows on rotation.
 */
export function Grid({ children, gap = 16 }) {
  const { columns } = useResponsive()
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]

  if (columns === 1) {
    return <View style={{ gap }}>{items}</View>
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((child, index) => (
        <View
          key={index}
          style={{
            // Subtract the gap share so N columns + gaps fit exactly.
            width: `${100 / columns}%`,
            paddingRight: 0,
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: `${(100 - gap * (columns - 1) * 0.1) / columns}%`,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  )
}
