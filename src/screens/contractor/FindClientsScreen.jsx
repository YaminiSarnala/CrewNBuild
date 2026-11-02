// Find Clients (the web sidebar's "Find Clients"), opened from the Builder
// dashboard. The leads list itself is ContractorLeadsScreen; this screen gives
// it the slim back header the other Builder screens use and clears the
// section's notifications when it opens, as the web does.
import { useLanguage } from '../../i18n/LanguageContext'
import { ShellBackBar } from '../../components/DashboardShell'
import { useMarkSectionRead } from '../../components/builder/BuilderInbox'
import ContractorLeadsScreen from './ContractorLeadsScreen'

export default function FindClientsScreen({ navigation }) {
  const { t } = useLanguage()
  useMarkSectionRead('findClients')
  return (
    <ShellBackBar title={t('ui.findClients')} onBack={() => navigation.goBack()}>
      <ContractorLeadsScreen navigation={navigation} />
    </ShellBackBar>
  )
}
