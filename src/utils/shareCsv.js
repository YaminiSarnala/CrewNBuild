// A CSV report as a real .csv FILE (web: a browser download). The text is
// written to the app's cache folder and handed to the share sheet, where the
// builder can save it to Files / Drive, open it in a spreadsheet app or send it.
//
// Needs expo-file-system and expo-sharing (both in Expo Go):
//   npx expo install expo-file-system expo-sharing
// If either is unavailable at run time, the CSV text is shared instead, which
// is what the app did before.
import { Share } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const safeName = (name) => String(name || 'report.csv').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'report.csv'

export async function shareCsvFile(csvText, fileName) {
  const name = safeName(fileName).toLowerCase().endsWith('.csv') ? safeName(fileName) : `${safeName(fileName)}.csv`
  try {
    if (await Sharing.isAvailableAsync()) {
      const file = new File(Paths.cache, name)
      if (file.exists) file.delete()
      file.create()
      file.write(csvText)
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: name })
      return
    }
  } catch {
    // fall through to the plain-text share below
  }
  await Share.share({ title: name, message: csvText })
}
