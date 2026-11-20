// The Help Center — port of the web pages/contractor/supportModals.jsx
// HelpCenterModal (the Site Engineer's account menu: Help & Feedback). The same
// questions and answers, one open at a time, and the support address.
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { SheetModal } from './builder/BuilderUi'
import { COLORS } from '../theme/tokens'
import { createStyles } from '../theme/createStyles'

// The Help Center's questions and answers, as translation keys (web HELP_FAQ_KEYS).
export const HELP_FAQ_KEYS = [
  { id: 'updateProfile', question: 'help.q.updateProfile', answer: 'ui.contractor.helpAnswerUpdateProfile' },
  { id: 'findClients', question: 'help.q.findClients', answer: 'ui.contractor.helpAnswerFindClients' },
  { id: 'requests', question: 'help.q.requests', answer: 'ui.contractor.helpAnswerRequests' },
  { id: 'trackSites', question: 'help.q.trackSites', answer: 'ui.contractor.helpAnswerTrackSites' },
  { id: 'escrow', question: 'help.q.escrow', answer: 'ui.contractor.helpAnswerEscrow' },
  { id: 'verifyDocuments', question: 'help.q.verifyDocuments', answer: 'ui.contractor.helpAnswerVerifyDocuments' },
]

export default function HelpCenterSheet({ visible, onClose }) {
  const { t } = useLanguage()
  const [openIndex, setOpenIndex] = useState(0)
  const faqs = [
    ...HELP_FAQ_KEYS.map((faq) => ({ question: t(faq.question), answer: t(faq.answer) })),
    { question: t('help.stillNeedHelp'), answer: t('help.supportContact') },
  ]
  return (
    <SheetModal
      visible={visible}
      tall
      title={t('ui.helpCenter')}
      subtitle={t('help.subtitle')}
      onClose={onClose}
      footer={(
        <Text style={styles.footer}>
          {`${t('ui.contractor.helpFooterBefore')} `}<Text style={styles.email}>support@crewnbuild.com</Text>{` ${t('ui.contractor.helpFooterAfter')}`}
        </Text>
      )}
    >
      <View style={{ gap: 8 }}>
        {faqs.map((faq, index) => {
          const open = openIndex === index
          return (
            <View key={faq.question} style={styles.item}>
              <Pressable onPress={() => setOpenIndex(open ? -1 : index)} style={styles.question}>
                <Text style={styles.questionText}>{faq.question}</Text>
                <ChevronDown size={16} color={COLORS.slate[400]} style={open ? { transform: [{ rotate: '180deg' }] } : null} />
              </Pressable>
              {open ? <Text style={styles.answer}>{faq.answer}</Text> : null}
            </View>
          )
        })}
      </View>
    </SheetModal>
  )
}

const styles = createStyles((c) => ({
  item: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  question: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  questionText: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
  answer: { borderTopWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, lineHeight: 20, color: c.textSoft },
  footer: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  email: { fontWeight: '800', color: c.brandText },
}))