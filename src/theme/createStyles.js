// Themed stylesheets.
//
//   const styles = createStyles((c) => ({
//     card: { backgroundColor: c.card, borderRadius: 24, padding: 20 },
//   }))
//   <View style={styles.card} />
//
// `c` is the current palette (palette.js). The sheet is built once per theme
// and cached; `styles.card` always reads the sheet for the active theme. A
// theme change remounts the navigator (see RootNavigator), so every screen
// renders again with the new sheet.
import { StyleSheet } from 'react-native'
import { DARK, LIGHT } from './palette'

let mode = 'light'

export function setStyleTheme(next) {
  mode = next === 'dark' ? 'dark' : 'light'
}

export function currentPalette() {
  return mode === 'dark' ? DARK : LIGHT
}

export function createStyles(factory) {
  const sheets = {}
  const sheet = () => {
    if (!sheets[mode]) sheets[mode] = StyleSheet.create(factory(currentPalette()))
    return sheets[mode]
  }
  return new Proxy({}, {
    get: (_, key) => sheet()[key],
    has: (_, key) => key in sheet(),
    ownKeys: () => Reflect.ownKeys(sheet()),
    getOwnPropertyDescriptor: (_, key) => ({ enumerable: true, configurable: true, value: sheet()[key] }),
  })
}
