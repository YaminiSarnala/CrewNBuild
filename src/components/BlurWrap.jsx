// Small helper so the navbar reads as frosted glass without pulling in
// expo-blur (which needs a config plugin). A high-opacity surface plus a
// hairline border gives the same visual weight as the web's backdrop-blur.
import { View } from 'react-native'
import { createStyles } from '../theme/createStyles'

export function BlurWrap({ children }) {
  return (
    <View style={styles.view}>
      {children}
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { borderBottomWidth: 1, borderColor: 'rgba(226, 232, 240, 0.7)', backgroundColor: c.paper },
}))
