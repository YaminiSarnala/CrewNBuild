// The Builder's "More" tab: every web sidebar / account-menu section that does
// not fit the five bottom tabs (web contractorConstants.baseNav + the account
// menu): Find Clients, Buy & Sell, Product Catalog, Portfolio, Plan & billing,
// Profile Settings, Messages and My Profile.
//
// Other screens open a section here with navigate('ContractorMoreTab', { section }).
// Labels use the web nav keys; mobile-only subtitles live in i18n/mobile/account.js.
import { useEffect, useState } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useSelector } from 'react-redux'
import { useLanguage } from '../../i18n/LanguageContext'
import {
  Users, ShoppingBag, Search, CircleUser, ArrowLeft, Package, Activity, CreditCard, Settings, MessageCircle, Building2,
} from 'lucide-react-native'
import ContractorLeadsScreen from './ContractorLeadsScreen'
import BuilderProductCatalogScreen from './BuilderProductCatalogScreen'
import ShopHubScreen from '../shared/ShopHubScreen'
import PropertyMarketSection from '../shared/PropertyMarketSection'
import ProfileScreen from '../shared/ProfileScreen'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import PropertySellSection from '../../components/builder/PropertySellSection'
import { Section, SegmentTabs, PremiumBadge } from '../../components/builder/BuilderUi'
import useBuilderSubscription from '../../hooks/useBuilderSubscription'
import { useBuilderInbox } from '../../components/builder/BuilderInbox'
import { fetchOwnerProjects } from '../../api/projects'

const GREEN = '#15803d'

const MENU = [
  { id: 'clients', titleKey: 'ui.findClients', subtitleKey: 'mobile.account.more.sub.clients', Icon: Search },
  { id: 'shop', titleKey: 'ui.buySell', subtitleKey: 'mobile.account.more.sub.shop', Icon: ShoppingBag },
  { id: 'catalog', titleKey: 'ui.productCatalog', subtitleKey: 'mobile.account.more.sub.catalog', Icon: Package },
  { id: 'portfolio', titleKey: 'subscription.portfolio.nav', subtitleKey: 'mobile.account.more.sub.portfolio', Icon: Activity, route: 'BuilderPortfolio' },
  { id: 'subscription', titleKey: 'subscription.panel.menu', subtitleKey: 'mobile.account.more.sub.subscription', Icon: CreditCard, route: 'BuilderSubscription' },
  { id: 'settings', titleKey: 'ui.profileSettings', subtitleKey: 'mobile.account.more.sub.settings', Icon: Settings, route: 'BuilderProfileSettings' },
  { id: 'messages', titleKey: 'ui.messages', subtitleKey: 'mobile.account.more.sub.messages', Icon: MessageCircle, route: 'Messages' },
  { id: 'profile', titleKey: 'mobile.account.more.myProfile', subtitleKey: 'mobile.account.more.sub.profile', Icon: CircleUser },
]
// Sections that exist only where the server offers builder plans.
const PLAN_SECTIONS = ['portfolio', 'subscription']

const STACK_SECTIONS =Object.fromEntries(MENU.filter((item) => item.route).map((item) => [item.id, item.route]))

function BuySellSection({ navigation }) {
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  // Buy & Sell opens on Sell for a Builder, as on the web.
  const [tab, setTab] = useState('sell')
  const projects = useAsyncData(() => fetchOwnerProjects().catch(() => []), [])
  const projectList = Array.isArray(projects.data) ? projects.data : []
  const buySellTabs = [
    { id: 'sell', label: t('property.tab.sell'), icon: Building2 },
    { id: 'buy', label: t('property.tab.buy'), icon: Search },
    { id: 'materials', label: t('site.estimate.result.materials'), icon: ShoppingBag },
  ]
  const tabs = (
    <Section>
      <SegmentTabs
        tabs={buySellTabs}
        active={tab}
        onChange={setTab}
      />
    </Section>
  )
  if (tab === 'materials') {
    // The existing mobile materials hub, unchanged.
    return (
      <View style={styles.screen}>
        <View style={styles.tabBar}>
          <SegmentTabs
            tabs={buySellTabs}
            active={tab}
            onChange={setTab}
          />
        </View>
        <ShopHubScreen
          navigation={navigation}
          loadProjects={fetchOwnerProjects}
          pickCheckoutProject={(list) => list[0] || null}
        />
      </View>
    )
  }
  return (
    <DashboardShell
      refreshing={false}
      onRefresh={() => projects.reload()}
      onOpenNotifications={() => navigation.navigate('Notifications')}
    >
      {tabs}
      {tab === 'sell'
        ? <PropertySellSection projects={projectList} defaultCountry={user?.country_of_residence || 'India'} />
        : <PropertyMarketSection />}
    </DashboardShell>
  )
}

export default function ContractorMoreScreen({ navigation, route }) {
  const { t } = useLanguage()
  const [section, setSection] = useState(null)
  const { status, unavailable: plansUnavailable } = useBuilderSubscription()
    const inbox = useBuilderInbox()
  // The web sidebar's badges for the sections that live here.
  const menuBadges = {
    clients: inbox.unseenClients || inbox.notificationCounts?.findClients || 0,
    messages: inbox.unreadMessages || 0,
    profile: inbox.notificationCounts?.profile || 0,
  }

  // Deep link from other tabs: navigate('ContractorMoreTab', { section }).
  const requested = route?.params?.section
  useEffect(() => {
    if (!requested) return
    if (STACK_SECTIONS[requested]) navigation.navigate(STACK_SECTIONS[requested])
    else setSection(requested)
    navigation.setParams?.({ section: undefined })
  }, [requested, navigation])

  const open = (item) => {
    if (item.route) navigation.navigate(item.route)
    else setSection(item.id)
  }

  if (section === 'clients') {
    return (
      <View style={styles.screen}>
        <BackHeader title={t('ui.findClients')} onBack={() => setSection(null)} />
        <ContractorLeadsScreen navigation={navigation} />
      </View>
    )
  }

  if (section === 'shop') {
    return (
      <View style={styles.screen}>
        <BackHeader title={t('ui.buySell')} onBack={() => setSection(null)} />
        <BuySellSection navigation={navigation} />
      </View>
    )
  }

  if (section === 'catalog') {
    return (
      <View style={styles.screen}>
        <BackHeader title={t('ui.productCatalog')} onBack={() => setSection(null)} />
        <BuilderProductCatalogScreen navigation={navigation} />
      </View>
    )
  }

  if (section === 'profile') {
    return (
      <View style={styles.screen}>
        <BackHeader title={t('mobile.account.more.myProfile')} onBack={() => setSection(null)} />
        <ProfileScreen navigation={navigation} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{t('mobile.account.more.eyebrow')}</Text>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{t('mobile.tab.more')}</Text>
        <PremiumBadge status={status} />
      </View>
      <Text style={styles.description}>
        {t('mobile.account.more.description')}
      </Text>

            {MENU.filter((item) => !(plansUnavailable && PLAN_SECTIONS.includes(item.id))).map((item) => {
        const { id, titleKey, subtitleKey, Icon } = item
        return (
          <Pressable
            key={id}
            onPress={() => open(item)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.iconBox}>
              <Icon size={23} color={GREEN} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{t(titleKey)}</Text>
              <Text style={styles.cardSubtitle}>{t(subtitleKey)}</Text>
            </View>
            {menuBadges[id] > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{menuBadges[id] > 9 ? '9+' : menuBadges[id]}</Text></View>
            ) : null}
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )
      })}

      <View style={styles.note}>
        <Users size={19} color={GREEN} />
        <Text style={styles.noteText}>
          {t('mobile.account.more.partnersNote')}
        </Text>
      </View>
    </ScrollView>
  )
}

function BackHeader({ title, onBack }) {
  const { t } = useLanguage()
  return (
    <View style={styles.backHeader}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel={t('dash.common.back')}>
        <ArrowLeft size={21} color="#17211b" />
      </Pressable>
      <Text style={styles.backTitle}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9f7' },
  content: { padding: 20, paddingBottom: 36 },
  eyebrow: { color: GREEN, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  heading: { color: '#17211b', fontSize: 30, fontWeight: '800' },
  description: { color: '#647067', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, borderWidth: 1, borderColor: '#e7ece8',
    padding: 15, marginBottom: 12,
  },
  pressed: { opacity: 0.75 },
  iconBox: {
    width: 46, height: 46, borderRadius: 13, backgroundColor: '#edf7ef',
    alignItems: 'center', justifyContent: 'center',
  },
  cardText: { flex: 1, marginLeft: 13 },
  cardTitle: { color: '#17211b', fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: '#748078', fontSize: 12, lineHeight: 17, marginTop: 4 },
  arrow: { color: '#8a968d', fontSize: 27, marginLeft: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#e11d48', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#edf7ef', padding: 14, borderRadius: 13, marginTop: 8,
  },
  noteText: { flex: 1, color: '#356345', fontSize: 12, lineHeight: 18 },
  backHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7ece8',
  },
  backButton: { padding: 5 },
  backTitle: { color: '#17211b', fontSize: 17, fontWeight: '700' },
  tabBar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
})
