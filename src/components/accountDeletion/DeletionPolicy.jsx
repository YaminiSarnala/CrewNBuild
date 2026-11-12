// Port of the web components/accountDeletion/DeletionPolicy.jsx: the account
// deletion policy, shown in the Delete Account form. The text is in
// policyText.js (a copy of the web's deletionPolicy.js, English as on the web).
import { View, Text } from 'react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'
import { POLICY_SECTIONS, POLICY_TITLE } from './policyText'

function Paragraph({ value }) {
  const parts = Array.isArray(value) ? value : [value]
  return (
    <Text style={styles.body}>
      {parts.map((part, index) => (typeof part === 'string'
        ? <Text key={index}>{part}</Text>
        : <Text key={index} style={styles.strong}>{part.strong}</Text>))}
    </Text>
  )
}

export default function DeletionPolicy() {
  const { t } = useLanguage()
  return (
    <View style={styles.box}>
      <Text style={styles.eyebrow}>{t('account.deletePolicy')}</Text>
      {t('account.deletePolicyNote') ? <Text style={styles.note}>{t('account.deletePolicyNote')}</Text> : null}
      <Text style={styles.title}>{POLICY_TITLE}</Text>
      {POLICY_SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          {section.intro ? <Text style={styles.body}>{section.intro}</Text> : null}
          {section.items?.map((item) => (
            <View key={item.label} style={styles.item}>
              <View style={styles.dot} />
              <Text style={[styles.body, { flex: 1 }]}>
                <Text style={styles.strong}>{item.label}:</Text> {item.text}
              </Text>
            </View>
          ))}
          {section.paragraphs?.map((paragraph, index) => <Paragraph key={index} value={paragraph} />)}
          {section.outro ? <Text style={styles.body}>{section.outro}</Text> : null}
          {section.quote ? <Text style={styles.quote}>“{section.quote}”</Text> : null}
        </View>
      ))}
    </View>
  )
}

const styles = createStyles((c) => ({
  box: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 12, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  note: { marginTop: -6, fontSize: 11.5, fontStyle: 'italic', color: c.textMuted },
  title: { fontSize: 13.5, fontWeight: '800', color: c.text },
  section: { gap: 5 },
  heading: { fontSize: 12.5, fontWeight: '800', color: c.text },
  body: { fontSize: 12, lineHeight: 18, color: c.textSecondary },
  strong: { fontWeight: '800', color: c.text },
  item: { flexDirection: 'row', gap: 8 },
  dot: { marginTop: 7, width: 5, height: 5, borderRadius: 3, backgroundColor: c.roseTextSoft },
  quote: { borderLeftWidth: 2, borderColor: c.roseBorder, paddingLeft: 10, fontSize: 12, lineHeight: 18, fontStyle: 'italic', color: c.textSecondary },
}))
